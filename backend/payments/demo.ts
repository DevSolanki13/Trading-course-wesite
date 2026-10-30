import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { PaymentEvent, PaymentOrder, PaymentProvider } from "./types";

const eventSchema = z
  .object({
    eventId: z.string().min(1).max(180),
    providerOrderId: z.string().regex(/^demo_[0-9a-f-]{36}$/i),
    status: z.enum(["paid", "failed", "pending", "cancelled"]),
    amountPaise: z.number().int().nonnegative().max(2147483647),
  })
  .strict();

export function isDemoPaymentEnabled(env: Record<string, string | undefined> = process.env) {
  return (
    env.PAYMENT_MODE === "demo" &&
    ["local", "staging"].includes(env.PROJECT_STAGE ?? "") &&
    env.VERCEL_ENV !== "production" &&
    validSecret(env.DEMO_PAYMENT_SECRET)
  );
}
function validSecret(raw: string | undefined): raw is string {
  const value = raw?.trim();
  return (
    !!value && value.length >= 32 && !/^(change|replace|example|market-method-demo)/i.test(value)
  );
}
function secret() {
  const value = process.env.DEMO_PAYMENT_SECRET?.trim();
  if (!validSecret(value)) throw new Error("Demo payments are not securely configured.");
  return value;
}
export function demoSignature(rawBody: string, timestamp: string) {
  return createHmac("sha256", secret())
    .update(timestamp + rawBody)
    .digest("base64");
}
export class DemoProvider implements PaymentProvider {
  async createOrder(order: PaymentOrder) {
    secret();
    return { providerOrderId: `demo_${order.id}`, checkoutUrl: `/pay/demo/${order.id}` };
  }
  verifyWebhook(rawBody: string, headers: Headers): PaymentEvent {
    const timestamp = headers.get("x-webhook-timestamp");
    const signature = headers.get("x-webhook-signature");
    if (
      !timestamp ||
      !/^\d{10}$/.test(timestamp) ||
      !signature ||
      !/^[A-Za-z0-9+/]{43}=$/.test(signature)
    )
      throw new Error("Invalid signature");
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error("Expired event");
    const expected = Buffer.from(demoSignature(rawBody, timestamp), "base64");
    const received = Buffer.from(signature, "base64");
    if (received.length !== expected.length || !timingSafeEqual(received, expected))
      throw new Error("Invalid signature");
    return eventSchema.parse(JSON.parse(rawBody));
  }
}
export class CashfreeProvider implements PaymentProvider {
  createOrder(): Promise<{ providerOrderId: string; checkoutUrl: string }> {
    throw new Error("Cashfree checkout is not available.");
  }
  verifyWebhook(): PaymentEvent {
    throw new Error("Cashfree settlement is not available.");
  }
}
export function paymentProvider(): PaymentProvider {
  return isDemoPaymentEnabled() ? new DemoProvider() : new CashfreeProvider();
}
export function idempotencyKey(userId: string, courseId: string) {
  return createHash("sha256").update(`${userId}:${courseId}`).digest("hex");
}
