import { createHash } from "node:crypto";
import { CashfreeClient, CashfreeError, paise, type Purchase } from "./cashfree.ts";

export type PaymentConfirmation = {
  providerOrderId: string;
  paymentId: string;
  amountPaise: number;
  currency: "INR";
  status: string;
  paidAt: string | null;
};
export type RefundRequest = {
  id: string;
  order_id: string;
  provider_reference: string;
  state: string;
};
export interface CommerceStore {
  order(id: string): Promise<Purchase>;
  payment(event: PaymentConfirmation, hash: string): Promise<void>;
  terminal(id: string, status: "failed" | "cancelled"): Promise<void>;
  refund(reference: string): Promise<RefundRequest>;
  refundState(reference: string, orderId: string, amount: number, state: string): Promise<void>;
}
export const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** API-confirmed reconciliation is shared by webhook delivery and scheduled retries. */
export async function reconcilePayment(
  client: CashfreeClient,
  store: CommerceStore,
  providerOrderId: string,
) {
  const local = await store.order(providerOrderId);
  const remote = await client.getOrder(providerOrderId);
  client.assertOrder(remote, local);
  const payments = await client.payments(providerOrderId);
  let successes = 0;
  for (const payment of payments) {
    if (
      payment.order_id !== local.provider_order_id ||
      paise(payment.payment_amount) !== local.total_paise
    )
      throw new Error("CASHFREE_PAYMENT_MISMATCH");
    if (payment.payment_status === "SUCCESS" && remote.order_status !== "PAID")
      throw new Error("CASHFREE_CONFIRMATION_PENDING");
    const event: PaymentConfirmation = {
      providerOrderId,
      paymentId: payment.cf_payment_id,
      amountPaise: local.total_paise,
      currency: "INR",
      status: payment.payment_status,
      paidAt: payment.payment_completion_time ?? null,
    };
    await store.payment(event, fingerprint(event));
    if (payment.payment_status === "SUCCESS") successes++;
  }
  if (remote.order_status === "PAID" && successes === 0)
    throw new Error("CASHFREE_PAYMENT_NOT_FOUND");
  if (successes) return "paid";
  if (["EXPIRED", "TERMINATED"].includes(remote.order_status)) {
    await store.terminal(
      providerOrderId,
      remote.order_status === "EXPIRED" ? "failed" : "cancelled",
    );
    return "closed";
  }
  return "pending";
}

export async function reconcileRefund(
  client: CashfreeClient,
  store: CommerceStore,
  orderId: string,
  reference: string,
  dispatch = false,
) {
  const request = await store.refund(reference);
  if (request.state === "refunded") return "refunded";
  if (!["approved", "processing", "failed"].includes(request.state))
    throw new Error("REFUND_NOT_APPROVED");
  const order = await store.order(orderId);
  if (request.order_id !== order.id || order.status !== "paid")
    throw new Error("REFUND_ORDER_MISMATCH");
  let result;
  try {
    result = await client.getRefund(orderId, reference);
  } catch (error) {
    if (
      !(error instanceof CashfreeError) ||
      error.status !== 404 ||
      !dispatch ||
      request.state === "failed"
    )
      throw error;
    // Set processing before the network call. A timeout preserves both access and
    // the same refund reference; the next run queries it before attempting POST.
    await store.refundState(reference, orderId, order.total_paise, "PENDING");
    result = await client.createRefund(order, reference, request.id);
  }
  if (
    result.order_id !== orderId ||
    result.refund_id !== reference ||
    paise(result.refund_amount) !== order.total_paise
  )
    throw new Error("CASHFREE_REFUND_MISMATCH");
  await store.refundState(reference, orderId, order.total_paise, result.refund_status);
  return result.refund_status === "SUCCESS"
    ? "refunded"
    : ["CANCELLED", "REJECTED"].includes(result.refund_status)
      ? "failed"
      : "pending";
}
