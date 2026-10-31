import {
  getPaymentProvider,
  PaymentsUnavailableError,
  InvalidPaymentSignatureError,
} from "@/backend/payments/providers";
import { settlePurchase } from "@/backend/purchase/service";
import { purchaseRpc } from "@/backend/purchase/repository";
import { sendPurchaseReceipt } from "@/backend/purchase/mail";
import type { PurchaseUser } from "@/shared/purchase";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const provider = getPaymentProvider();
    if (provider.name !== "razorpay") return Response.json({ error: "Not found" }, { status: 404 });
    const result = await provider.handleWebhook(request);
    if (result) {
      await settlePurchase(result);
      if (result.status === "paid") {
        const owner = await purchaseRpc<{ orderId: string; user: PurchaseUser } | null>(
          "purchase_payment_owner",
          { p_provider_id: result.providerOrderId },
        );
        if (owner) await sendPurchaseReceipt(owner.orderId, owner.user);
      }
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook rejected or deferred; details withheld.");
    return Response.json(
      {
        error:
          error instanceof PaymentsUnavailableError
            ? "Webhook not configured"
            : "Webhook could not be verified or stored",
      },
      { status: error instanceof InvalidPaymentSignatureError ? 401 : 503 },
    );
  }
}
