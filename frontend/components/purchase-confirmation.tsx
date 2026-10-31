"use client";
import { useEffect } from "react";
import Link from "next/link";
import { accessExpiryLabel } from "../../shared/course-access";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { PurchaseOrder } from "../../shared/purchase";
export function PurchaseConfirmation({
  order,
  expired = false,
}: {
  order: PurchaseOrder;
  expired?: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    if (order.status === "paid" && !expired)
      toast.success("Your course is ready.", { id: `paid:${order.id}` });
  }, [order.id, order.status, expired]);
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
      {order.accessExpiresAt && (
        <p>Course access until {accessExpiryLabel(order.accessExpiresAt)}.</p>
      )}
      {order.status === "paid" ? (
        <>
          <p>
            {expired
              ? "This purchase's access period has ended. Your receipt remains available."
              : "Your course is available in your dashboard. Your receipt is saved with this purchase."}
          </p>
          <Link
            className="button button-primary"
            href={expired ? `/checkout/${order.slug}` : `/learn/${order.slug}`}
          >
            {expired ? "Renew course access" : "Start learning"}
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
