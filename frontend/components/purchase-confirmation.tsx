"use client";
import { useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { PurchaseOrder } from "../../shared/purchase";
export function PurchaseConfirmation({ order }: { order: PurchaseOrder }) {
  const router = useRouter();
  useEffect(() => {
    if (order.status === "paid") toast.success("Your course is ready.", { id: `paid:${order.id}` });
  }, [order.id, order.status]);
  return (
    <section className="checkout-card">
      {order.provider === "mock" && (
        <div className="demo-banner">TEST MODE: no real money is charged</div>
      )}
      <h1>
        {order.status === "paid"
          ? "Payment confirmed"
          : order.status === "pending"
            ? "Waiting for confirmation"
            : order.status === "refunded"
              ? "Payment refunded"
              : "Payment not completed"}
      </h1>
      <p>{order.courseTitle}</p>
      <p>Order id: {order.id}</p>
      {order.status === "paid" ? (
        <>
          <p>
            Your course is available in your dashboard. Your receipt is saved with this purchase.
          </p>
          <Link className="button button-primary" href={`/learn/${order.slug}`}>
            Start learning
          </Link>
          <p>
            <Link href={`/dashboard/orders/${order.id}/receipt`}>View printable receipt</Link>
          </p>
        </>
      ) : order.status === "pending" ? (
        <>
          <p>Check this saved order again shortly. Avoid paying twice.</p>
          <button className="button button-secondary" onClick={() => router.refresh()}>
            Check again
          </button>
        </>
      ) : (
        <Link className="button button-secondary" href={`/checkout/${order.courseId}`}>
          Retry checkout
        </Link>
      )}
      <p>
        <Link className="text-link" href="/dashboard">
          Go to dashboard
        </Link>
      </p>
    </section>
  );
}
