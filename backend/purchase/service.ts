import { upiConfig } from "../payments/upi-config.ts";
import { getCheckoutProvider, type VerifiedPayment } from "../payments/providers.ts";
import { purchaseOrder, purchaseRpc } from "./repository.ts";
import type { PurchaseOrder, PurchaseUser } from "../../shared/purchase.ts";
export async function createPurchase(
  user: PurchaseUser,
  course: string,
  origin: string,
  coupon?: string,
): Promise<PurchaseOrder> {
  const provider = getCheckoutProvider();
  const id = await purchaseRpc<string>("purchase_create_order", {
    p_user: user.id,
    p_course: course,
    p_provider: provider.name,
    p_origin: origin,
    ...(coupon ? { p_coupon: coupon } : {}),
  });
  if (provider.name === "upi") {
    const config = upiConfig();
    await purchaseRpc("purchase_upi_reserve", {
      p_user: user.id,
      p_order: id,
      p_vpa: config.vpa,
      p_payee: config.payeeName,
    });
    return (await purchaseOrder(id, user.id))!;
  }
  throw new Error("Only UPI checkout is available.");
}

export async function settlePurchase(event: VerifiedPayment) {
  await purchaseRpc("purchase_settle", { p_event: event });
}
