import { randomUUID } from "node:crypto";
import { IndianxtradeGateway } from "../payments/indianxtrade.ts";
import { GatewayError } from "../payments/gateway-error.ts";
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
  let order = (await purchaseOrder(orderId, userId))!;
  if (order.providerOrderId) return order;
  const claim = randomUUID();
  let prepared = false;
  let knownToken = false;
  let creationRequested = false;
  let startedAt = Date.now();
  try {
    const setup = await purchaseRpc<{
      state: "create" | "resume" | "busy" | "unknown";
      token?: string;
      createdAt: string;
      retryAfter?: number;
    }>("purchase_upi_gateway_prepare", {
      p_user: userId,
      p_order: orderId,
      p_claim: claim,
    });
    if (setup.state === "busy" || setup.state === "unknown") {
      const error = new GatewayError(setup.state === "busy" ? "SETUP_PENDING" : "CREATION_UNKNOWN");
      error.retryAfter = setup.retryAfter;
      throw error;
    }
    prepared = true;
    knownToken = !!setup.token;
    startedAt = Date.parse(setup.createdAt);
    // Read the quote after acquiring the database lease; setup now freezes its amount.
    order = (await purchaseOrder(orderId, userId))!;
    const gateway = new IndianxtradeGateway();
    let token = setup.token;
    if (!token) {
      creationRequested = true;
      token = await gateway.create(order.amount);
    }
    knownToken = true;
    if (!setup.token)
      await purchaseRpc("purchase_upi_gateway_save", {
        p_user: userId,
        p_order: orderId,
        p_claim: claim,
        p_token: token,
      });
    const createdAt = Date.parse(setup.createdAt);
    if (createdAt + 50 * 60000 <= Date.now()) {
      const status = await gateway.status(token);
      if (status === "EXPIRED" || status === "REJECTED") {
        await purchaseRpc("purchase_upi_gateway_abandon", {
          p_user: userId,
          p_order: orderId,
          p_claim: claim,
          p_token: token,
        });
        return (await purchaseOrder(orderId, userId))!;
      }
      throw new GatewayError("SETUP_EXPIRED");
    }
    const remote = await gateway.checkoutIntent(token, order.amount, createdAt);
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
  } catch (reason) {
    let error = reason instanceof GatewayError ? reason : new GatewayError("SETUP_STORAGE");
    if (creationRequested && !knownToken && !error.safeToRetryCreation) {
      error = new GatewayError("CREATION_UNKNOWN");
      error.retryAfter = Math.max(1, Math.ceil((startedAt + 65 * 60000 - Date.now()) / 1000));
    }
    error.orderId = orderId;
    error.order = order;
    if (prepared) {
      try {
        await purchaseRpc("purchase_upi_gateway_release", {
          p_user: userId,
          p_order: orderId,
          p_claim: claim,
          p_safe_retry: !knownToken && (!creationRequested || error.safeToRetryCreation),
        });
      } catch {
        // The durable reservation remains protected even if releasing the short lease fails.
      }
    }
    throw error;
  }
}
