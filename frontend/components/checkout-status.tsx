"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Order = {
  id: string;
  status: "paid" | "failed" | "pending" | "cancelled" | "refunded";
  demo: boolean;
  course_snapshot: { slug?: string; title?: string };
};
const labels: Record<Order["status"], string> = {
  paid: "Payment confirmed",
  failed: "Payment was not completed",
  pending: "Waiting for confirmation",
  cancelled: "Checkout cancelled",
  refunded: "Payment refunded",
};
export function CheckoutStatus({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let checks = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`/api/checkout/status/${encodeURIComponent(orderId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(data.error || "Order status is unavailable.");
        setOrder(data.order);
        if (data.order.status === "pending") {
          if (++checks < 40) timer = setTimeout(load, 3000);
          else setExpired(true);
        }
      } catch (reason) {
        if (active)
          setError(reason instanceof Error ? reason.message : "Could not check this order.");
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [orderId, attempt]);
  function retry() {
    setError("");
    setExpired(false);
    setAttempt((n) => n + 1);
  }
  const slug = order?.course_snapshot.slug;
  return (
    <section className="checkout-card" aria-labelledby="order-heading">
      {order?.demo && <div className="demo-banner">DEMO MODE — no real payment</div>}
      <h1 id="order-heading">
        {order
          ? labels[order.status]
          : error
            ? "We couldn’t check your order"
            : "Checking your payment…"}
      </h1>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <div role="status" aria-live="polite">
        {!order && !error && <p>Checking confirmation securely. Please keep this page open.</p>}
        {order?.status === "pending" && (
          <p>
            {expired
              ? "Confirmation is taking longer than expected. Your order is saved. Check again or return to your learning space; avoid paying twice."
              : "Your payment is still being confirmed. Your course unlocks only after confirmation."}
          </p>
        )}
        {order?.status === "paid" && (
          <p>
            {order.course_snapshot.title ?? "Your course"} has been added to your learning space.
          </p>
        )}
        {order?.status === "failed" && (
          <p>Payment was not confirmed. Check your payment history before trying again.</p>
        )}
        {order?.status === "cancelled" && (
          <p>You can return to the course whenever you are ready.</p>
        )}
        {order?.status === "refunded" && (
          <p>This order was refunded. Access from this purchase has ended.</p>
        )}
      </div>
      {(error || expired) && (
        <button className="button button-secondary" onClick={retry}>
          Check again
        </button>
      )}
      {order?.status === "paid" && slug && (
        <Link className="button button-primary" href={`/learn/${slug}`}>
          Start learning
        </Link>
      )}
      {["failed", "cancelled"].includes(order?.status ?? "") && slug && (
        <Link className="button button-secondary" href={`/checkout/${slug}`}>
          Return to checkout
        </Link>
      )}
      <p>
        <Link className="text-link" href="/learn">
          Go to my learning space
        </Link>
      </p>
      <p className="checkout-note">Order reference: {orderId}</p>
    </section>
  );
}
