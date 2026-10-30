import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePurchaseUser } from "@/backend/purchase/pages";
import { purchaseOrder } from "@/backend/purchase/repository";
import { PrintReceipt } from "@/frontend/components/print-receipt";
export const dynamic = "force-dynamic";
export const metadata = { title: "Purchase receipt", robots: { index: false, follow: false } };
export default async function Receipt({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await requirePurchaseUser(`/dashboard/orders/${orderId}/receipt`);
  const order = await purchaseOrder(orderId, user.id);
  if (!order || !["paid", "refunded"].includes(order.status)) notFound();
  const money = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: order.currency }).format(n / 100);
  return (
    <main id="main-content" className="container">
      <article className="purchase-receipt">
        {order.provider === "mock" && (
          <div className="demo-banner">TEST MODE: no real money is charged</div>
        )}
        <h1>Purchase receipt</h1>
        <p>Order {order.id}</p>
        <p>Customer: {user.name}</p>
        <p>Course: {order.courseTitle}</p>
        <p>Status: {order.status}</p>
        <p>
          {order.paidAt
            ? new Date(order.paidAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
            : ""}{" "}
          IST
        </p>
        <dl className="purchase-summary">
          <div>
            <dt>Course price</dt>
            <dd>{money(order.base)}</dd>
          </div>
          <div>
            <dt>Taxes</dt>
            <dd>{money(order.tax)}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{money(order.amount)}</dd>
          </div>
        </dl>
        <p>This payment acknowledgement is not a GST tax invoice.</p>
        <PrintReceipt />
        <p>
          <Link className="text-link" href="/dashboard/orders">
            Back to purchase history
          </Link>
        </p>
      </article>
    </main>
  );
}
