import { randomUUID } from "node:crypto";
import { IndianxtradeGateway } from "../payments/indianxtrade.ts";
import { purchaseOrder, purchaseRpc } from "./repository.ts";
import type { PurchaseOrder } from "../../shared/purchase.ts";

type GatewayInfo = { token: string; amount: number };
export async function reconcileGatewayPurchase(order: PurchaseOrder, userId: string) {
  if (order.provider !== "upi" || order.status !== "pending") return order;
  const info = await purchaseRpc<GatewayInfo | null>("purchase_upi_gateway_info", {
    p_user: userId,
    p_order: order.id,
  });
  if (!info) return order;
  const status = await new IndianxtradeGateway().status(info.token);
  if (status === "COMPLETED") {
    await purchaseRpc("purchase_settle", {
      p_event: {
        provider: "upi",
        providerOrderId: order.providerOrderId,
        providerPaymentId: `upi_indianxtrade_${info.token}`,
        amount: info.amount,
        currency: "INR",
        status: "paid",
      },
    });
    return (await purchaseOrder(order.id, userId))!;
  }
  if (status === "EXPIRED" || status === "REJECTED") {
    await purchaseRpc("purchase_upi_gateway_close", { p_user: userId, p_order: order.id });
    return (await purchaseOrder(order.id, userId))!;
  }
  return order;
}
export async function bindGatewayPurchase(orderId: string, userId: string) {
  const order = (await purchaseOrder(orderId, userId))!;
  if (order.providerOrderId) return order;
  const claim = randomUUID();
  if (
    !(await purchaseRpc<boolean>("purchase_claim_creation", {
      p_user: userId,
      p_order: orderId,
      p_claim: claim,
    }))
  )
    throw new Error(
      "Payment setup is pending. Check this saved order before creating another payment.",
    );
  const remote = await new IndianxtradeGateway().create(order.amount);
  await purchaseRpc("purchase_upi_gateway_bind", {
    p_user: userId,
    p_order: orderId,
    p_claim: claim,
    p_token: remote.token,
    p_amount: remote.amount,
    p_vpa: remote.vpa,
    p_payee: remote.payeeName,
    p_expires: remote.expiresAt,
    p_uri: remote.uri,
  });
  return (await purchaseOrder(orderId, userId))!;
}
