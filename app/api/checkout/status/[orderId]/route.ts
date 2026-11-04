import { z } from "zod";
import { admitted } from "@/backend/auth/session";
import { AuthError, failure, json, limit } from "@/backend/auth/http";
import { CashfreeClient, cashfreeSandboxEnabled } from "@/backend/payments/cashfree";
import { commerceStore } from "@/backend/payments/data";
import { reconcilePayment } from "@/backend/payments/workflow";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const context = await admitted();
    await limit(request, "checkout-status", context.user.id, 60, 60);
    const { orderId } = await params;
    if (!z.string().uuid().safeParse(orderId).success) throw new AuthError(404, "Order not found.");

    const { data: initialData, error } = await context.admin
      .from("orders")
      .select(
        "id,status,total_paise,base_paise,discount_paise,course_snapshot,paid_at,gst_enabled,tax_paise,provider_order_id",
      )
      .eq("id", orderId)
      .eq("user_id", context.user.id)
      .maybeSingle();

    if (error) throw new AuthError(503, "Order status is temporarily unavailable.");
    if (!initialData) throw new AuthError(404, "Order not found.");
    let data = initialData;

    // Phase 4A: Reconcile with Cashfree API on user return if payment is still marked pending
    if (
      data.status === "pending" &&
      data.provider_order_id?.startsWith("cf_sbx_") &&
      cashfreeSandboxEnabled()
    ) {
      try {
        await reconcilePayment(
          new CashfreeClient(),
          commerceStore(context.admin),
          data.provider_order_id,
        );
        const refreshed = await context.admin
          .from("orders")
          .select(
            "id,status,total_paise,base_paise,discount_paise,course_snapshot,paid_at,gst_enabled,tax_paise,provider_order_id",
          )
          .eq("id", orderId)
          .eq("user_id", context.user.id)
          .maybeSingle();
        if (refreshed.data) {
          data = refreshed.data;
        }
      } catch {
        // Reconcile is non-fatal: return current database state
      }
    }

    const { provider_order_id: providerId, ...order } = data;
    return json({
      order: {
        ...order,
        demo: providerId?.startsWith("demo_") === true,
        sandbox: providerId?.startsWith("cf_sbx_") === true,
      },
    });
  } catch (error) {
    return failure(error);
  }
}
