import { z } from "zod";
import { admitted } from "@/backend/auth/session";
import { AuthError, body, failure, json, limit, sameOrigin } from "@/backend/auth/http";
import { demoSignature, isDemoPaymentEnabled } from "@/backend/payments/demo";
import { CashfreeClient, cashfreeSandboxEnabled } from "@/backend/payments/cashfree";
import { commerceStore } from "@/backend/payments/data";
import { appOrigin } from "@/backend/auth/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const sandbox = cashfreeSandboxEnabled();
  if (!isDemoPaymentEnabled() && !sandbox)
    return json({ error: "Checkout is not available." }, 404);
  try {
    sameOrigin(request);
    const context = await admitted();
    await limit(request, "checkout", context.user.id, 12, 60);
    const parsed = z
      .object({
        slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
        terms: z.literal(true),
        phone: z
          .string()
          .regex(/^[6-9][0-9]{9}$/)
          .optional(),
      })
      .strict()
      .safeParse(await body(request));
    if (!parsed.success)
      throw new AuthError(400, "Choose a course and accept the terms to continue.");
    // Validate configuration before creating an order. Never use a shared fallback secret.
    if (sandbox && !parsed.data.phone)
      throw new AuthError(400, "Enter a valid ten-digit Indian mobile number.");
    if (!sandbox) demoSignature("configuration-check", "0");
    const { data, error } = await context.admin.rpc(
      sandbox ? "commerce_create_order" : "demo_create_order",
      {
        p_user: context.user.id,
        p_session: context.sessionId,
        p_slug: parsed.data.slug,
        ...(sandbox ? { p_phone: parsed.data.phone } : {}),
      },
    );
    if (error?.code === "23505")
      throw new AuthError(409, "You already have access to this course.", "ALREADY_OWNED");
    if (error?.code === "22023") throw new AuthError(409, "This course is not ready for checkout.");
    if (error || !data)
      throw new AuthError(503, "Checkout is temporarily unavailable. Please retry.");
    if (sandbox) {
      const order = await commerceStore(context.admin).order(
        `cf_sbx_${String(data).replaceAll("-", "")}`,
      );
      const client = new CashfreeClient();
      // Stable local order UUID is the API idempotency key. The browser receives
      // only our internal checkout URL; a timeout can safely retry this same order.
      await client.createOrder(order, appOrigin());
    }
    return json({ checkoutUrl: `/pay/${sandbox ? "cashfree" : "demo"}/${data}`, orderId: data });
  } catch (error) {
    return failure(error);
  }
}
