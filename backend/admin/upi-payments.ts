import { AuthError } from "../auth/http";
import { purchaseOrder } from "../purchase/repository";
import { reconcileGatewayPurchase } from "../purchase/upi-gateway";

export function upiPaymentParams(url: URL) {
  const tab = url.searchParams.get("tab") ?? "review";
  if (!["review", "unmatched", "history"].includes(tab))
    throw new AuthError(400, "Choose a payment view.");
  const page = Number(url.searchParams.get("page") ?? 0);
  return {
    p_tab: tab,
    p_query: (url.searchParams.get("q") ?? "").trim().slice(0, 120),
    p_page: Number.isSafeInteger(page) && page >= 0 ? Math.min(page, 10000) : 0,
  };
}
export async function checkAcademyUpiPayment(orderId: string, userId: string) {
  const order = await purchaseOrder(orderId, userId);
  if (!order || order.provider !== "upi") throw new AuthError(404, "UPI order not found.");
  const result = await reconcileGatewayPurchase(order, userId);
  return {
    message:
      result.status === "paid"
        ? "Payment confirmed and course access recorded."
        : result.status === "cancelled"
          ? "The gateway closed this checkout."
          : "The gateway has not confirmed payment yet. No course access was granted.",
  };
}
