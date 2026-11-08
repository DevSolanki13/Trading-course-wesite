"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle, Clock, XCircle, ArrowCounterClockwise } from "@phosphor-icons/react";
import { PaymentFireworks } from "./payment-fireworks";

type Order = {
  id: string;
  status: "paid" | "failed" | "pending" | "cancelled" | "refunded";
  demo: boolean;
  sandbox?: boolean;
  paymentStatus?: "paid" | "pending" | "failed" | "cancelled";
  canRetry?: boolean;
  confirmationUnavailable?: boolean;
  course_snapshot: { slug?: string; title?: string };
};
const labels: Record<Order["status"], string> = {
  paid: "Payment confirmed",
  failed: "Payment failed",
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
    let inFlight = false;
    let stopped = false;
    let checks = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const isHidden = () => document.visibilityState === "hidden";
    const load = async () => {
      if (!active || inFlight || stopped || isHidden()) return;
      clearTimeout(timer);
      inFlight = true;
      try {
        const response = await fetch(`/api/checkout/status/${encodeURIComponent(orderId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(data.error || "Order status is unavailable.");
        setOrder(data.order);
        if (
          data.order.status === "pending" &&
          !["failed", "cancelled"].includes(data.order.paymentStatus)
        ) {
          if (++checks < 40) {
            if (!isHidden()) timer = setTimeout(load, 3000);
          } else {
            stopped = true;
            setExpired(true);
          }
        } else stopped = true;
      } catch (reason) {
        if (active) {
          stopped = true;
          setError(reason instanceof Error ? reason.message : "Could not check this order.");
        }
      } finally {
        inFlight = false;
      }
    };
    const resume = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "hidden") void load();
    };
    document.addEventListener("visibilitychange", resume);
    void load();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [orderId, attempt]);
  function retry() {
    setError("");
    setExpired(false);
    setAttempt((n) => n + 1);
  }
  const slug = order?.course_snapshot.slug;
  const attemptEnded =
    order?.status === "pending" && ["failed", "cancelled"].includes(order.paymentStatus ?? "");
  const status = attemptEnded ? (order?.paymentStatus as "failed" | "cancelled") : order?.status;
  const retryUrl =
    attemptEnded && order?.canRetry && order.sandbox
      ? `/pay/cashfree/${orderId}`
      : order && ["failed", "cancelled"].includes(order.status) && slug
        ? `/checkout/${slug}`
        : null;
  return (
    <section
      className="checkout-card checkout-status-card"
      data-status={status ?? "checking"}
      aria-labelledby="order-heading"
    >
      {status === "paid" && order && !order.confirmationUnavailable && (
        <PaymentFireworks key={order.id} orderId={order.id} />
      )}
      {order?.sandbox ? (
        <div className="demo-banner">CASHFREE SANDBOX — test payment only</div>
      ) : order?.demo ? (
        <div className="demo-banner">DEMO MODE — no real payment</div>
      ) : null}
      <div className="checkout-state-icon" aria-hidden="true">
        {status === "failed" || status === "cancelled" ? (
          <XCircle size={36} />
        ) : status === "paid" ? (
          <CheckCircle size={36} />
        ) : (
          <Clock size={36} />
        )}
      </div>
      <h1 id="order-heading">
        {status
          ? expired && status === "pending"
            ? "Confirmation delayed"
            : labels[status]
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
        {status === "pending" && (
          <p>
            {order?.confirmationUnavailable
              ? "We couldn’t verify the latest payment status. Check again before making another payment. Your saved order is unchanged."
              : expired
                ? "Confirmation is taking longer than expected. Your order is saved. Check again or return to your learning space; avoid paying twice."
                : "Your payment is still being confirmed. Your course unlocks only after confirmation."}
          </p>
        )}
        {status === "paid" && order && (
          <p>
            {order.course_snapshot.title ?? "Your course"} has been added to your learning space.
          </p>
        )}
        {status === "failed" && (
          <p>
            This payment could not be completed. Your course has not been unlocked. Check your
            billing history before trying again.
          </p>
        )}
        {status === "cancelled" && (
          <p>
            This payment was cancelled or left incomplete. You can return to your saved checkout
            when you are ready.
          </p>
        )}
        {order?.status === "refunded" && (
          <p>This order was refunded. Access from this purchase has ended.</p>
        )}
      </div>
      <div className="checkout-status-actions">
        {retryUrl && (
          <Link className="button button-primary" href={retryUrl}>
            <ArrowCounterClockwise size={18} aria-hidden="true" /> Try payment again
          </Link>
        )}
        {(error || expired || attemptEnded || order?.confirmationUnavailable) && (
          <button className="button button-secondary" onClick={retry}>
            Check again
          </button>
        )}
        {status === "paid" && slug && (
          <Link className="button button-primary" href={`/learn/${slug}`}>
            Start learning
          </Link>
        )}
        {["paid", "failed", "cancelled"].includes(status ?? "") && (
          <Link className="button button-secondary" href="/dashboard?view=billing">
            View billing & receipts
          </Link>
        )}
      </div>
      <p className="checkout-status-back">
        <Link className="text-link" href="/dashboard?view=explore">
          Back to explore courses
        </Link>
      </p>
      <p className="checkout-note">Order reference: {orderId}</p>
    </section>
  );
}
