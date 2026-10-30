"use client";
import { useState } from "react";
import { useHydrated } from "../lib/use-hydrated";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { toast } from "sonner";
import type { PurchaseCourse, PurchaseOrder } from "../../shared/purchase";
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value / 100);
type RazorpayResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type RazorpayInstance = { open: () => void; on: (name: string, callback: () => void) => void };
type GatewayWindow = Window & {
  Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
};
export function PurchaseCheckout({
  course,
  provider,
  available = true,
  tax,
  nonce,
}: {
  course: PurchaseCourse;
  provider: "mock" | "razorpay";
  available?: boolean;
  tax: number;
  nonce?: string;
}) {
  const router = useRouter();
  const interactive = useHydrated();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  async function api(action: string, payload: unknown) {
    const r = await fetch(`/api/purchase/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (r.status === 401) {
      router.push(`/login?redirect=${encodeURIComponent(`/checkout/${course.id}`)}`);
      throw new Error("Please sign in to continue.");
    }
    if (data.code === "ALREADY_OWNED") {
      router.push(`/learn/${course.slug}`);
      throw new Error("You already own this course.");
    }
    if (!r.ok)
      throw new Error(data.error ?? "Payment could not be confirmed. Check your saved order.");
    return data;
  }
  async function verify(saved: PurchaseOrder, payment: RazorpayResult) {
    try {
      const result = await api("verify", { orderId: saved.id, payment });
      if (result.order.status === "paid") router.push(`/checkout/success?orderId=${saved.id}`);
      else {
        setError("Payment confirmation is pending. Check the saved order before retrying.");
        setBusy(false);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Verification failed");
      setBusy(false);
    }
  }
  async function pay(outcome: "paid" | "failed" | "cancelled") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await api("create", { courseId: course.id, terms: true });
      const saved = data.order as PurchaseOrder;
      setOrder(saved);
      if (data.provider === "razorpay") {
        const Gateway = (window as GatewayWindow).Razorpay;
        if (!Gateway) throw new Error("The payment service has not loaded. Try again shortly.");
        const gateway = new Gateway({
          key: data.keyId,
          order_id: saved.providerOrderId,
          amount: saved.amount,
          currency: saved.currency,
          name: "Market Method",
          description: course.title,
          handler: (result: RazorpayResult) => void verify(saved, result),
          modal: {
            ondismiss: () => {
              setBusy(false);
              toast.info("Payment window closed. Check your saved order before retrying.");
            },
          },
        });
        gateway.on("payment.failed", () => {
          setBusy(false);
          setFailed(true);
          setError(
            "Payment failed. No course access was granted. You can retry this saved checkout.",
          );
        });
        gateway.open();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const result = await api("mock", { orderId: saved.id, outcome });
      if (outcome === "cancelled") {
        toast.info("Test payment cancelled.");
        router.push(`/courses/${course.slug}`);
        return;
      }
      if (result.order.status === "paid") {
        toast.success("Payment confirmed. Your course is ready.");
        router.push(`/checkout/success?orderId=${saved.id}`);
        return;
      }
      setFailed(true);
      setError("The test payment failed. You have not been enrolled. Please try again.");
      toast.error("Test payment failed.");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Payment could not be processed.";
      setError(message);
      toast.error(message);
      setBusy(false);
    } finally {
      if (provider === "mock") setBusy(false);
    }
  }
  return (
    <section className="checkout-card" aria-labelledby="purchase-title">
      {provider === "mock" && (
        <div className="demo-banner" role="note">
          TEST MODE: no real money is charged
        </div>
      )}
      {provider === "razorpay" && (
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          nonce={nonce}
          onReady={() => setReady(true)}
          onError={() => {
            setError("Payments temporarily unavailable");
            setBusy(false);
          }}
        />
      )}
      <h1 id="purchase-title">
        {failed ? "Your payment was not completed" : "Review your course"}
      </h1>
      <h2>{course.title}</h2>
      <p>{course.description}</p>
      <dl className="purchase-summary">
        <div>
          <dt>Course price</dt>
          <dd>{money(course.price)}</dd>
        </div>
        <div>
          <dt>Taxes</dt>
          <dd>{money(tax)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{money(course.price + tax)}</dd>
        </div>
      </dl>
      <label className="terms-check">
        <input
          type="checkbox"
          disabled={!interactive || busy}
          checked={terms}
          onChange={(event) => setTerms(event.target.checked)}
        />
        <span>
          I agree to the <Link href="/terms">terms</Link> and{" "}
          <Link href="/refund-policy">refund policy</Link>.
        </span>
      </label>
      {!available && (
        <p className="auth-error" role="alert">
          Payments temporarily unavailable
        </p>
      )}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {busy && (
        <p role="status" aria-live="polite">
          Processing your payment…
        </p>
      )}
      <div className="gateway-actions">
        <button
          className="button button-primary"
          onClick={() => void pay("paid")}
          disabled={!terms || busy || !available || (provider === "razorpay" && !ready)}
        >
          {busy
            ? "Processing…"
            : provider === "mock"
              ? failed
                ? "Retry test payment"
                : "Pay successfully"
              : "Pay with Razorpay"}
        </button>
        {provider === "mock" && (
          <>
            <button
              className="button button-secondary"
              disabled={!terms || busy || !available}
              onClick={() => void pay("failed")}
            >
              Simulate failure
            </button>
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() =>
                terms ? void pay("cancelled") : router.push(`/courses/${course.slug}`)
              }
            >
              Cancel
            </button>
          </>
        )}
      </div>
      {order && (
        <p className="checkout-note">
          Order reference: {order.id} ·{" "}
          <Link href={`/checkout/success?orderId=${order.id}`}>Check order status</Link>
        </p>
      )}
    </section>
  );
}
