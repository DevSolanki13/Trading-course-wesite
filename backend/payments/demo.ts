import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentEvent, PaymentOrder, PaymentProvider } from "./types";

const secret = () => process.env.DEMO_PAYMENT_SECRET?.trim() || "market-method-demo-secret";

export function demoSignature(rawBody: string, timestamp: string) {
  return createHmac("sha256", secret()).update(timestamp + rawBody).digest("base64");
}

export class DemoProvider implements PaymentProvider {
  async createOrder(order: PaymentOrder) {
    return { providerOrderId: `demo_${order.id}`, checkoutUrl: `/pay/demo/${order.id}` };
  }
  verifyWebhook(rawBody: string, headers: Headers): PaymentEvent {
    const timestamp = headers.get("x-webhook-timestamp");
    const signature = headers.get("x-webhook-signature");
    if (!timestamp || !signature || !/^\d{10,16}$/.test(timestamp)) throw new Error("Invalid signature");
    const expected = Buffer.from(demoSignature(rawBody, timestamp), "base64");
    const received = Buffer.from(signature, "base64");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("Invalid signature");
    const payload = JSON.parse(rawBody) as PaymentEvent;
    if (!payload.eventId || !payload.providerOrderId || !Number.isInteger(payload.amountPaise)) throw new Error("Invalid event");
    return payload;
  }
}

export class CashfreeProvider implements PaymentProvider {
  createOrder(): Promise<{ providerOrderId: string; checkoutUrl: string }> { throw new Error("Cashfree provider not implemented"); }
  verifyWebhook(): PaymentEvent { throw new Error("Cashfree provider not implemented"); }
}

export function paymentProvider(): PaymentProvider {
  if (process.env.PAYMENT_MODE === "demo" && process.env.PROJECT_STAGE !== "production") return new DemoProvider();
  return new CashfreeProvider();
}
export function isDemoPaymentEnabled() { return process.env.PAYMENT_MODE === "demo" && process.env.PROJECT_STAGE !== "production"; }
export function idempotencyKey(userId: string, courseId: string) { return createHash("sha256").update(`${userId}:${courseId}`).digest("hex"); }
