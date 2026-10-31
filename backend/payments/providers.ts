import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { configuredValue, type Environment } from "../config/environment.ts";

export type CreatePaymentOrder = {
  userId: string;
  courseId: string;
  amount: number;
  currency: "INR";
  receiptId?: string;
};
export type ProviderOrder = { providerOrderId: string; amount: number; currency: "INR" };
export type VerifiedPayment = ProviderOrder & {
  provider: "mock" | "razorpay";
  providerPaymentId: string;
  status: "paid" | "failed" | "cancelled" | "refunded";
};
export interface PaymentProvider {
  readonly name: "mock" | "razorpay";
  createOrder(input: CreatePaymentOrder): Promise<ProviderOrder>;
  verifyPayment(payload: unknown): Promise<VerifiedPayment>;
  handleWebhook(request: Request): Promise<VerifiedPayment | null>;
}
export class PaymentsUnavailableError extends Error {
  constructor() {
    super("Payments temporarily unavailable");
  }
}
export class InvalidPaymentSignatureError extends Error {}
const amount = z.number().int().min(100).max(2147483647);
const createSchema = z.object({
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
  amount,
  currency: z.literal("INR"),
  receiptId: z.string().uuid().optional(),
});
function matchesHmac(value: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    createHmac("sha256", secret).update(value).digest(),
  );
}
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  async createOrder(input: CreatePaymentOrder) {
    const parsed = createSchema.parse(input);
    return {
      providerOrderId: `mock_${parsed.receiptId ?? randomUUID()}`,
      amount: parsed.amount,
      currency: parsed.currency,
    };
  }
  async verifyPayment(payload: unknown): Promise<VerifiedPayment> {
    const data = z
      .object({
        providerOrderId: z.string().regex(/^mock_[a-f0-9-]{36}$/),
        amount,
        currency: z.literal("INR"),
        outcome: z.enum(["paid", "failed", "cancelled"]),
      })
      .strict()
      .parse(payload);
    return {
      provider: "mock",
      providerOrderId: data.providerOrderId,
      providerPaymentId: `mock_tx_${data.providerOrderId.slice(5)}_${data.outcome}`,
      amount: data.amount,
      currency: data.currency,
      status: data.outcome,
    };
  }
  async handleWebhook(): Promise<null> {
    return null;
  } // Mock success is authenticated, same-origin and owner-scoped.
}

/** Razorpay server-specific code stays in this class. A future Stripe adapter
 * keeps this contract and settlement layer; its hosted checkout UI would also
 * need the corresponding Stripe client SDK instead of Razorpay's widget. */
export class RealPaymentProvider implements PaymentProvider {
  readonly name = "razorpay";
  private env: Environment;
  private fetcher: typeof fetch;
  constructor(env: Environment = process.env, fetcher: typeof fetch = fetch) {
    this.env = { ...env };
    this.fetcher = fetcher;
  }
  private async api(path: string, method = "GET", data?: unknown): Promise<unknown> {
    const response = await this.fetcher(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.env.RAZORPAY_KEY_ID}:${this.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        `Payment service unavailable (${response.status}). Check your saved order before retrying.`,
      );
    return response.json();
  }
  async createOrder(input: CreatePaymentOrder): Promise<ProviderOrder> {
    const data = createSchema.parse(input);
    if (data.receiptId) {
      const collection = z
        .object({
          items: z.array(
            z.object({
              id: z.string().regex(/^order_[a-zA-Z0-9]+$/),
              receipt: z.string(),
              amount,
              currency: z.literal("INR"),
              notes: z.object({ userId: z.string(), courseId: z.string() }),
            }),
          ),
        })
        .parse(await this.api(`/orders?receipt=${encodeURIComponent(data.receiptId)}&count=100`));
      const existing = collection.items.find((order) => order.receipt === data.receiptId);
      if (existing) {
        if (
          existing.amount !== data.amount ||
          existing.notes.userId !== data.userId ||
          existing.notes.courseId !== data.courseId
        )
          throw new Error("Payment order mismatch");
        return {
          providerOrderId: existing.id,
          amount: existing.amount,
          currency: existing.currency,
        };
      }
    }
    const raw = await this.api("/orders", "POST", {
      amount: data.amount,
      currency: data.currency,
      receipt: data.receiptId ?? randomUUID(),
      notes: { userId: data.userId, courseId: data.courseId },
    });
    const result = z
      .object({ id: z.string().regex(/^order_[a-zA-Z0-9]+$/), amount, currency: z.literal("INR") })
      .parse(raw);
    if (result.amount !== data.amount) throw new Error("Payment order amount mismatch");
    return { providerOrderId: result.id, amount: result.amount, currency: result.currency };
  }
  private async fetchPayment(paymentId: string, orderId?: string): Promise<VerifiedPayment> {
    if (!/^pay_[a-zA-Z0-9]+$/.test(paymentId)) throw new Error("Invalid payment reference");
    const p = z
      .object({
        id: z.string(),
        order_id: z.string().regex(/^order_[a-zA-Z0-9]+$/),
        amount,
        currency: z.literal("INR"),
        status: z.string(),
        amount_refunded: z.number().int().optional(),
      })
      .parse(await this.api(`/payments/${paymentId}`));
    if (p.id !== paymentId || (orderId && p.order_id !== orderId))
      throw new Error("Payment reference mismatch");
    const status =
      p.status === "captured"
        ? "paid"
        : p.status === "failed"
          ? "failed"
          : p.status === "refunded" && p.amount_refunded === p.amount
            ? "refunded"
            : null;
    if (!status)
      throw new Error(
        "Payment is awaiting capture or reconciliation. Check this order again shortly.",
      );
    return {
      provider: "razorpay",
      providerOrderId: p.order_id,
      providerPaymentId: p.id,
      amount: p.amount,
      currency: p.currency,
      status,
    };
  }
  async verifyPayment(payload: unknown) {
    const p = z
      .object({
        razorpay_order_id: z.string().regex(/^order_[a-zA-Z0-9]+$/),
        razorpay_payment_id: z.string().regex(/^pay_[a-zA-Z0-9]+$/),
        razorpay_signature: z.string(),
      })
      .strict()
      .parse(payload);
    if (
      !matchesHmac(
        `${p.razorpay_order_id}|${p.razorpay_payment_id}`,
        p.razorpay_signature,
        this.env.RAZORPAY_KEY_SECRET ?? "",
      )
    )
      throw new InvalidPaymentSignatureError("Invalid payment signature");
    return this.fetchPayment(p.razorpay_payment_id, p.razorpay_order_id);
  }
  async handleWebhook(request: Request) {
    if (!configuredValue(this.env.RAZORPAY_WEBHOOK_SECRET)) throw new PaymentsUnavailableError();
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Empty webhook");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1048576) {
        await reader.cancel();
        throw new Error("Webhook too large");
      }
      chunks.push(value);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    if (
      !matchesHmac(
        raw,
        request.headers.get("x-razorpay-signature") ?? "",
        this.env.RAZORPAY_WEBHOOK_SECRET!,
      )
    )
      throw new InvalidPaymentSignatureError("Invalid webhook signature");
    const event = z.object({ event: z.string(), payload: z.unknown() }).parse(JSON.parse(raw));
    if (
      ![
        "payment.captured",
        "payment.failed",
        "payment.refunded",
        "refund.processed",
        "order.paid",
      ].includes(event.event)
    )
      return null;
    const parsed = z
      .object({ payment: z.object({ entity: z.object({ id: z.string() }) }) })
      .safeParse(event.payload);
    if (parsed.success) return this.fetchPayment(parsed.data.payment.entity.id);
    const refund = z
      .object({ refund: z.object({ entity: z.object({ payment_id: z.string() }) }) })
      .safeParse(event.payload);
    return refund.success ? this.fetchPayment(refund.data.refund.entity.payment_id) : null;
  }
}
let warned = false;
export function getPaymentProvider(
  env: Environment = process.env,
  fetcher: typeof fetch = fetch,
): PaymentProvider {
  if (
    env.PAYMENT_PROVIDER === "razorpay" &&
    configuredValue(env.RAZORPAY_KEY_ID) &&
    configuredValue(env.RAZORPAY_KEY_SECRET)
  )
    return new RealPaymentProvider(env, fetcher);
  if (env.NODE_ENV === "production" && env.ALLOW_MOCK_PAYMENTS !== "true") {
    if (!warned) {
      console.error(
        "PAYMENTS DISABLED: production Razorpay configuration is missing. Mock payments require explicit ALLOW_MOCK_PAYMENTS=true.",
      );
      warned = true;
    }
    throw new PaymentsUnavailableError();
  }
  return new MockPaymentProvider();
}
export function mockPaymentsAllowed(env: Environment = process.env) {
  try {
    return getPaymentProvider(env).name === "mock";
  } catch {
    return false;
  }
}
