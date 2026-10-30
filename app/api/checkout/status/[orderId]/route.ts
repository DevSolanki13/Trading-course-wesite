import { z } from "zod";
import { admitted } from "@/backend/auth/session";
import { AuthError, failure, json } from "@/backend/auth/http";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const context = await admitted();
    const { orderId } = await params;
    if (!z.string().uuid().safeParse(orderId).success) throw new AuthError(404, "Order not found.");
    const { data, error } = await context.admin
      .from("orders")
      .select(
        "id,status,total_paise,base_paise,discount_paise,course_snapshot,paid_at,gst_enabled,tax_paise,provider_order_id",
      )
      .eq("id", orderId)
      .eq("user_id", context.user.id)
      .maybeSingle();
    if (error) throw new AuthError(503, "Order status is temporarily unavailable.");
    if (!data) throw new AuthError(404, "Order not found.");
    const { provider_order_id: providerId, ...order } = data;
    return json({ order: { ...order, demo: providerId?.startsWith("demo_") === true } });
  } catch (error) {
    return failure(error);
  }
}
