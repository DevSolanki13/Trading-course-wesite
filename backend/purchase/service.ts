import { randomUUID } from "node:crypto";
import { getPaymentProvider, type VerifiedPayment } from "../payments/providers.ts";
import { purchaseOrder, purchaseRpc } from "./repository.ts";
import type { PurchaseOrder, PurchaseUser } from "../../shared/purchase.ts";
export async function createPurchase(
  user: PurchaseUser,
  course: string,
  origin: string,
): Promise<PurchaseOrder> {
  const provider = getPaymentProvider();
  const id = await purchaseRpc<string>("purchase_create_order", {
    p_user: user.id,
    p_course: course,
    p_provider: provider.name,
    p_origin: origin,
  });
  let order = (await purchaseOrder(id, user.id))!;
  if (!order.providerOrderId) {
    const claim = randomUUID();
    if (
      !(await purchaseRpc<boolean>("purchase_claim_creation", {
        p_user: user.id,
        p_order: id,
        p_claim: claim,
      }))
    )
      throw new Error(
        "Payment setup is pending. Check this saved order before creating another payment.",
      );
    const remote = await provider.createOrder({
      userId: user.id,
      courseId: order.courseId,
      amount: order.amount,
      currency: order.currency,
      receiptId: id,
    });
    await purchaseRpc("purchase_bind_order", {
      p_user: user.id,
      p_order: id,
      p_claim: claim,
      p_provider_id: remote.providerOrderId,
    });
    order = (await purchaseOrder(id, user.id))!;
  }
  return order;
}
export async function settlePurchase(event: VerifiedPayment) {
  await purchaseRpc("purchase_settle", { p_event: event });
}
