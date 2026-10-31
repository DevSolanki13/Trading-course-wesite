import type { BillingDocument } from "./document.ts";
/** Ownership is checked against both the order and its immutable document. */
export function canReadBilling(
  userId: string,
  order: { id: string; user_id: string; status: string },
  document: { order_id: string; user_id: string } | null,
) {
  return (
    !!document &&
    order.user_id === userId &&
    document.user_id === userId &&
    document.order_id === order.id &&
    ["paid", "refunded"].includes(order.status)
  );
}
export type SavedBillingDocument = BillingDocument & { order_id: string; user_id: string };
