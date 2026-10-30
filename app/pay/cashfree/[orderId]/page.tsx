import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { admitted } from "@/backend/auth/session";
import { AuthError } from "@/backend/auth/http";
import { CashfreeClient, cashfreeSandboxEnabled } from "@/backend/payments/cashfree";
import { commerceStore } from "@/backend/payments/data";
import { CashfreePaymentPanel } from "@/frontend/components/cashfree-payment-panel";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sandbox payment", robots: { index: false, follow: false } };
export default async function CashfreePayment({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  if (!cashfreeSandboxEnabled()) notFound();
  const { orderId } = await params;
  if (!z.string().uuid().safeParse(orderId).success) notFound();
  let context;
  try {
    context = await admitted();
  } catch (error) {
    if (error instanceof AuthError && error.status === 401)
      redirect(`/login?next=${encodeURIComponent(`/pay/cashfree/${orderId}`)}`);
    throw error;
  }
  const order = await commerceStore(context.admin).order(`cf_sbx_${orderId.replaceAll("-", "")}`);
  if (order.user_id !== context.user.id) notFound();
  if (order.status !== "pending") redirect(`/checkout/status/${orderId}`);
  const client = new CashfreeClient();
  const remote = await client.getOrder(order.provider_order_id);
  client.assertOrder(remote, order);
  if (remote.order_status !== "ACTIVE" || !remote.payment_session_id)
    redirect(`/checkout/status/${orderId}`);
  return (
    <main id="main-content" className="checkout-page container">
      <CashfreePaymentPanel
        orderId={orderId}
        sessionId={remote.payment_session_id}
        totalPaise={order.total_paise}
        nonce={(await headers()).get("x-nonce") ?? undefined}
      />
    </main>
  );
}
