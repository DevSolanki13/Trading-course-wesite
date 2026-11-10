import { sharedUpiGateway } from "../payments/indianxtrade.ts";
import { bindGatewayPurchase, reconcileGatewayPurchase } from "./upi-gateway.ts";
import { upiConfig } from "../payments/upi-config.ts";
import { getCheckoutProvider, type VerifiedPayment } from "../payments/providers.ts";
import {
  purchaseOrder,
  purchaseOrders,
  purchaseRpc,
  purchaseQuoteCoupon,
  purchaseCourse,
} from "./repository.ts";
import type { PurchaseOrder, PurchaseUser } from "../../shared/purchase.ts";
export async function createPurchase(
  user: PurchaseUser,
  course: string,
  origin: string,
  coupon?: string,
): Promise<PurchaseOrder> {
  const provider = getCheckoutProvider(process.env, user.id);
  if (sharedUpiGateway()) {
    const existing = (await purchaseOrders(user.id)).find(
      (order) =>
        (order.courseId === course || order.slug === course) &&
        order.status === "pending" &&
        order.provider === "upi",
    );
    if (existing) {
      const reconciled = await reconcileGatewayPurchase(existing, user.id);
      if (reconciled.status === "paid") return reconciled;
      if (reconciled.status === "pending" && existing.providerOrderId)
        return (await purchaseOrder(existing.id, user.id))!;
      if (reconciled.status === "pending") return bindGatewayPurchase(existing.id, user.id);
    }
  }
  if (sharedUpiGateway()) {
    const quote = coupon ? await purchaseQuoteCoupon(course, coupon, user.id) : null;
    const catalogCourse = quote ? null : await purchaseCourse(course, user.id);
    const total = quote?.total ?? catalogCourse?.price;
    if (total !== undefined && total < 51000)
      throw new Error(
        "Shared UPI checkout requires a total of at least INR 510. Remove the coupon or contact support.",
      );
  }
  const id = await purchaseRpc<string>("purchase_create_order", {
    p_user: user.id,
    p_course: course,
    p_provider: provider.name,
    p_origin: origin,
    ...(coupon ? { p_coupon: coupon } : {}),
  });
  if (sharedUpiGateway()) return bindGatewayPurchase(id, user.id);
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
