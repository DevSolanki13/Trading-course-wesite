import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePurchaseUser } from "@/backend/purchase/pages";
import { purchaseConfirmation } from "@/backend/purchase/repository";
import { PurchaseConfirmation } from "@/frontend/components/purchase-confirmation";
export const dynamic = "force-dynamic";
export const metadata = { title: "Order confirmation", robots: { index: false, follow: false } };
export default async function Success({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  if (!z.string().uuid().safeParse(q.orderId).success) notFound();
  const user = await requirePurchaseUser(`/checkout/success?orderId=${q.orderId}`);
  const { order, expired } = await purchaseConfirmation(String(q.orderId), user.id);
  if (!order) notFound();
  return (
    <main id="main-content" className="container checkout-page">
      <PurchaseConfirmation order={order} expired={expired} />
    </main>
  );
}
