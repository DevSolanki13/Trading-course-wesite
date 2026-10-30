import { z } from "zod";
import { admitted } from "@/backend/auth/session";
import { AuthError, body, failure, json, limit, sameOrigin } from "@/backend/auth/http";
import { isDemoPaymentEnabled } from "@/backend/payments/demo";
import { settleDemoPayment } from "@/backend/payments/settlement";

export const runtime = "nodejs";
const inputSchema = z
  .object({
    orderId: z.string().uuid(),
    status: z.enum(["paid", "failed", "pending", "cancelled"]),
  })
  .strict();
export async function POST(request: Request) {
  if (!isDemoPaymentEnabled()) return json({ error: "Not found" }, 404);
  try {
    sameOrigin(request);
    const context = await admitted();
    await limit(request, "demo-simulation", context.user.id, 20, 60);
    const parsed = inputSchema.safeParse(await body(request));
    if (!parsed.success) throw new AuthError(400, "Invalid simulation.");
    const { orderId, status } = parsed.data;
    const { data: order, error } = await context.admin
      .from("orders")
      .select("id,provider_order_id,total_paise")
      .eq("id", orderId)
      .eq("user_id", context.user.id)
      .maybeSingle();
    if (error) throw new AuthError(503, "Payment lookup is unavailable.");
    if (!order?.provider_order_id?.startsWith("demo_"))
      throw new AuthError(404, "Payment attempt not found.");
    // Direct internal call avoids signing arbitrary HTTP requests or trusting a Host header.
    await settleDemoPayment({
      eventId: `demo_${orderId}_${status}`,
      providerOrderId: order.provider_order_id,
      status,
      amountPaise: order.total_paise,
    });
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
