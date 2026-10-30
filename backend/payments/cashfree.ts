import { z } from "zod";
import { configuredValue, type Environment } from "../config/environment.ts";

const uuid = z.string().uuid();
const providerId = z.string().regex(/^cf_sbx_[0-9a-f]{32}$/);
const identifier = z
  .union([z.string().min(1).max(180), z.number().int().nonnegative().safe()])
  .transform(String);
const money = z.number().finite().nonnegative().max(21474836.47);
export function paise(value: number): number {
  const result = Math.round(value * 100);
  if (!Number.isSafeInteger(result) || result < 0 || Math.abs(result / 100 - value) > 0.0000001)
    throw new Error("INVALID_PROVIDER_AMOUNT");
  return result;
}
export const cashfreeOrderSchema = z.object({
  order_id: providerId,
  order_amount: money,
  order_currency: z.literal("INR"),
  order_status: z.enum(["ACTIVE", "PAID", "EXPIRED", "TERMINATED", "TERMINATION_REQUESTED"]),
  payment_session_id: z.string().min(1).max(4096).optional(),
  customer_details: z.object({ customer_id: uuid }),
});
export const cashfreePaymentSchema = z
  .object({
    cf_payment_id: identifier,
    order_id: providerId,
    payment_amount: money,
    payment_currency: z.literal("INR"),
    payment_status: z.enum([
      "SUCCESS",
      "NOT_ATTEMPTED",
      "FAILED",
      "USER_DROPPED",
      "VOID",
      "CANCELLED",
      "PENDING",
    ]),
    payment_completion_time: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .superRefine((payment, context) => {
    if (payment.payment_status === "SUCCESS" && !payment.payment_completion_time)
      context.addIssue({
        code: "custom",
        message: "Successful payment requires its provider completion time",
      });
  });
export const cashfreeRefundSchema = z.object({
  order_id: providerId,
  refund_id: z.string().regex(/^refund_[a-f0-9]{32}$/),
  refund_amount: money,
  refund_currency: z.literal("INR"),
  refund_status: z.enum([
    "SUCCESS",
    "PENDING",
    "PENDING_APPROVAL",
    "CANCELLED",
    "ONHOLD",
    "REJECTED",
  ]),
});
export type CashfreeOrder = z.infer<typeof cashfreeOrderSchema>;
export type CashfreePayment = z.infer<typeof cashfreePaymentSchema>;
export type CashfreeRefund = z.infer<typeof cashfreeRefundSchema>;
export type Purchase = {
  id: string;
  user_id: string;
  provider_order_id: string;
  total_paise: number;
  status: string;
  created_at: string;
  billing_snapshot: { customer_email: string; customer_phone: string; customer_name: string };
};
export function cashfreeSandboxEnabled(env: Environment = process.env) {
  return (
    env.PAYMENT_MODE === "cashfree-sandbox" &&
    ["local", "staging"].includes(env.PROJECT_STAGE ?? "") &&
    env.VERCEL_ENV !== "production" &&
    env.CASHFREE_ENV === "sandbox" &&
    configuredValue(env.CASHFREE_CLIENT_ID) &&
    configuredValue(env.CASHFREE_CLIENT_SECRET) &&
    env.CASHFREE_API_VERSION === "2026-01-01"
  );
}
export class CashfreeError extends Error {
  status: number;
  constructor(status: number) {
    super(`CASHFREE_HTTP_${status}`);
    this.status = status;
  }
}

/** Sandbox-only adapter. Never accepts an API host or a URL from the browser. */
export class CashfreeClient {
  private env: Environment;
  private fetcher: typeof fetch;
  constructor(env: Environment = process.env, fetcher: typeof fetch = fetch) {
    if (!cashfreeSandboxEnabled(env)) throw new Error("CASHFREE_SANDBOX_DISABLED");
    this.env = { ...env };
    this.fetcher = fetcher;
  }
  private async request(
    path: string,
    method = "GET",
    body?: unknown,
    key?: string,
  ): Promise<unknown> {
    const response = await this.fetcher(`https://sandbox.cashfree.com/pg${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-client-id": this.env.CASHFREE_CLIENT_ID!,
        "x-client-secret": this.env.CASHFREE_CLIENT_SECRET!,
        "x-api-version": "2026-01-01",
        ...(key ? { "x-idempotency-key": uuid.parse(key) } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) throw new CashfreeError(response.status);
    return response.json();
  }
  async createOrder(order: Purchase, origin: string) {
    uuid.parse(order.id);
    uuid.parse(order.user_id);
    providerId.parse(order.provider_order_id);
    const url = new URL(origin);
    if (
      url.username ||
      url.password ||
      url.origin !== origin ||
      (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname))
    )
      throw new Error("INVALID_RETURN_ORIGIN");
    if (
      !Number.isInteger(order.total_paise) ||
      order.total_paise < 100 ||
      order.total_paise > 2147483647
    )
      throw new Error("INVALID_ORDER_AMOUNT");
    if (!/^[6-9][0-9]{9}$/.test(order.billing_snapshot.customer_phone))
      throw new Error("CUSTOMER_PHONE_REQUIRED");
    let result: CashfreeOrder;
    try {
      result = cashfreeOrderSchema.parse(
        await this.request(
          "/orders",
          "POST",
          {
            order_id: order.provider_order_id,
            order_amount: order.total_paise / 100,
            order_currency: "INR",
            customer_details: {
              customer_id: order.user_id,
              customer_email: order.billing_snapshot.customer_email,
              customer_phone: order.billing_snapshot.customer_phone,
              customer_name: order.billing_snapshot.customer_name,
            },
            order_expiry_time: new Date(
              new Date(order.created_at).getTime() + 3600000,
            ).toISOString(),
            order_meta: {
              return_url: `${origin}/checkout/status/${order.id}`,
              notify_url: `${origin}/api/webhooks/cashfree`,
            },
          },
          order.id,
        ),
      );
    } catch (error) {
      if (!(error instanceof CashfreeError) || error.status !== 409) throw error;
      result = await this.getOrder(order.provider_order_id);
    }
    this.assertOrder(result, order);
    return result;
  }
  async getOrder(id: string) {
    return cashfreeOrderSchema.parse(await this.request(`/orders/${providerId.parse(id)}`));
  }
  async payments(id: string) {
    return z
      .array(cashfreePaymentSchema)
      .parse(await this.request(`/orders/${providerId.parse(id)}/payments`));
  }
  async getRefund(orderId: string, reference: string) {
    return cashfreeRefundSchema.parse(
      await this.request(
        `/orders/${providerId.parse(orderId)}/refunds/${z
          .string()
          .regex(/^refund_[a-f0-9]{32}$/)
          .parse(reference)}`,
      ),
    );
  }
  async createRefund(order: Purchase, reference: string, requestId: string) {
    z.string()
      .regex(/^refund_[a-f0-9]{32}$/)
      .parse(reference);
    const raw = await this.request(
      `/orders/${providerId.parse(order.provider_order_id)}/refunds`,
      "POST",
      {
        refund_id: reference,
        refund_amount: order.total_paise / 100,
        refund_note: "Approved course refund",
        refund_speed: "STANDARD",
      },
      requestId,
    );
    // Version 2026-01-01 may return multiple payment-level refunds. Only a
    // single exact full-order result is accepted by this full-refund workflow.
    return cashfreeRefundSchema.parse(Array.isArray(raw) && raw.length === 1 ? raw[0] : raw);
  }
  assertOrder(remote: CashfreeOrder, local: Purchase) {
    if (
      remote.order_id !== local.provider_order_id ||
      remote.customer_details.customer_id !== local.user_id ||
      paise(remote.order_amount) !== local.total_paise
    )
      throw new Error("CASHFREE_ORDER_MISMATCH");
  }
}

export function webhookReference(input: unknown): { orderId: string; refundId?: string } | null {
  const base = z.object({ type: z.string(), data: z.record(z.string(), z.unknown()) }).parse(input);
  if (
    ["PAYMENT_SUCCESS_WEBHOOK", "PAYMENT_FAILED_WEBHOOK", "PAYMENT_USER_DROPPED_WEBHOOK"].includes(
      base.type,
    )
  ) {
    const data = z.object({ order: z.object({ order_id: providerId }) }).parse(base.data);
    return { orderId: data.order.order_id };
  }
  if (base.type === "REFUND_STATUS_WEBHOOK") {
    const data = z
      .object({
        refund: z.object({
          order_id: providerId,
          refund_id: z.string().regex(/^refund_[a-f0-9]{32}$/),
        }),
      })
      .parse(base.data);
    return { orderId: data.refund.order_id, refundId: data.refund.refund_id };
  }
  return null;
}
