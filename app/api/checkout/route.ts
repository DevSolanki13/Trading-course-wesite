import { z } from "zod";
import { admitted } from "@/backend/auth/session";
import { AuthError, body, failure, json, limit, sameOrigin } from "@/backend/auth/http";
import { demoSignature, isDemoPaymentEnabled } from "@/backend/payments/demo";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!isDemoPaymentEnabled()) return json({ error: "Checkout is not available." }, 404);
  try {
    sameOrigin(request);
    const context = await admitted();
    await limit(request, "checkout", context.user.id, 12, 60);
    const parsed = z
      .object({ slug: z.string().regex(/^[a-z0-9-]{1,120}$/), terms: z.literal(true) })
      .strict()
      .safeParse(await body(request));
    if (!parsed.success)
      throw new AuthError(400, "Choose a course and accept the terms to continue.");
    // Validate configuration before creating an order. Never use a shared fallback secret.
    demoSignature("configuration-check", "0");
    const { data, error } = await context.admin.rpc("demo_create_order", {
      p_user: context.user.id,
      p_session: context.sessionId,
      p_slug: parsed.data.slug,
    });
    if (error?.code === "23505")
      throw new AuthError(409, "You already have access to this course.", "ALREADY_OWNED");
    if (error?.code === "22023") throw new AuthError(409, "This course is not ready for checkout.");
    if (error || !data)
      throw new AuthError(503, "Checkout is temporarily unavailable. Please retry.");
    return json({ checkoutUrl: `/pay/demo/${data}`, orderId: data });
  } catch (error) {
    return failure(error);
  }
}
