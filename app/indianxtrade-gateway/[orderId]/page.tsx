import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePurchaseUser } from "@/backend/purchase/pages";
import { purchaseCourse, purchaseConfirmation } from "@/backend/purchase/repository";
import { IndianxtradeGatewayPage } from "@/frontend/components/indianxtrade-gateway";
import { sendPurchaseReceipt } from "@/backend/purchase/mail";

export const dynamic = "force-dynamic";
export const metadata = { title: "IndianXTrade Gateway", robots: { index: false, follow: false } };

export default async function GatewayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!z.string().uuid().safeParse(orderId).success) notFound();
  const user = await requirePurchaseUser(`/indianxtrade-gateway/${orderId}`);
  const { order, expired } = await purchaseConfirmation(orderId, user.id);
  if (!order || order.provider !== "upi") notFound();
  if (order.status === "paid") await sendPurchaseReceipt(order.id, user);
  const course = await purchaseCourse(order.courseId, user.id);
  if (!course) notFound();
  return <IndianxtradeGatewayPage initialOrder={order} course={course} accessExpired={expired} />;
}
