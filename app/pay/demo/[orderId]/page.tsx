import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DemoPaymentPanel } from "@/frontend/components/demo-payment-panel";
import { isDemoPaymentEnabled } from "@/backend/payments/demo";
import { admitted } from "@/backend/auth/session";
import { AuthError } from "@/backend/auth/http";
export const dynamic = "force-dynamic";
export default async function DemoPayPage({ params }: { params: Promise<{ orderId: string }> }) {
  if (!isDemoPaymentEnabled()) notFound();
  const { orderId } = await params;
  if (!z.string().uuid().safeParse(orderId).success) notFound();
  let context;
  try {
    context = await admitted();
  } catch (error) {
    const next = encodeURIComponent(`/pay/demo/${orderId}`);
    if (error instanceof AuthError && error.status === 401) redirect(`/login?next=${next}`);
    if (error instanceof AuthError && error.code === "DEVICE_LIMIT")
      redirect(`/auth/devices?next=${next}`);
    throw error;
  }
  const { data: order, error } = await context.admin
    .from("orders")
    .select("status,total_paise,provider_order_id")
    .eq("id", orderId)
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (error) throw new Error("Order lookup unavailable.");
  if (!order?.provider_order_id?.startsWith("demo_")) notFound();
  if (order.status !== "pending") redirect(`/checkout/status/${orderId}`);
  return (
    <main id="main-content" className="demo-pay-page container">
      <DemoPaymentPanel orderId={orderId} totalPaise={order.total_paise} />
    </main>
  );
}
