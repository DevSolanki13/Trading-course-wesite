"use client";
import { useEffect, useRef, useState } from "react";
import { useHydrated } from "../lib/use-hydrated";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { toast } from "sonner";
import type { PurchaseCourse, PurchaseOrder } from "../../shared/purchase";
import { ArrowRight, CheckCircle, Clock, LockSimple, Tag } from "@phosphor-icons/react";
import {
  CourseReview,
  PaymentBack,
  PaymentShell,
  PaymentTotals,
  accessLabel,
} from "./payment-layout";
import { CheckoutLayout, checkoutMoney } from "./checkout-layout";
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
  provider: "mock" | "razorpay" | "upi";
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
  const [razorpayKeyId, setRazorpayKeyId] = useState<string | undefined>();
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number } | null>(
    null,
  );
  const [couponBusy, setCouponBusy] = useState(false);
  const paying = useRef(false);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [setupBlocked, setSetupBlocked] = useState(false);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setTimeout(() => setRetryAt(null), Math.max(0, retryAt - Date.now()));
    return () => clearTimeout(timer);
  }, [retryAt]);
  function saveOrder(saved: PurchaseOrder) {
    setOrder(saved);
    if (saved.couponCode !== undefined) {
      setCoupon(saved.couponCode ?? "");
      setCouponApplied(
        saved.couponCode
          ? {
              code: saved.couponCode,
              discount:
                saved.couponDiscount ??
                saved.base + saved.tax - saved.amount - (saved.gatewaySavings ?? 0),
            }
          : null,
      );
    }
  }
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
    if (!r.ok) {
      if (action === "create" && data.order) {
        saveOrder(data.order);
        setSetupBlocked(data.retryable === false);
        if (Number.isFinite(data.retryAfter) && data.retryAfter > 0)
          setRetryAt(Date.now() + data.retryAfter * 1000);
      }
      throw new Error(
        (data.error ?? "Payment could not be confirmed. Check your saved order.") +
          (data.reference ? ` Support reference: ${data.reference}` : ""),
      );
    }
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
    if (!terms || busy || paying.current || retryAt || setupBlocked) return;
    paying.current = true;
    setBusy(true);
    setError("");
    try {
      let saved = order;
      let activeKeyId = razorpayKeyId;
      if (!saved || saved.status !== "pending" || (provider === "upi" && !saved.upi)) {
        const data = await api("create", {
          courseId: course.id,
          terms: true,
          ...(couponApplied ? { coupon: couponApplied.code } : {}),
        });
        saved = data.order as PurchaseOrder;
        activeKeyId = data.keyId;
        saveOrder(saved);
        if (data.keyId) setRazorpayKeyId(data.keyId);
      }
      if (provider === "upi") {
        router.push(`/indianxtrade-gateway/${saved.id}`);
        setBusy(false);
        return;
      }
      if (provider === "razorpay") {
        const Gateway = (window as GatewayWindow).Razorpay;
        if (!Gateway) throw new Error("The payment service has not loaded. Try again shortly.");
        const gateway = new Gateway({
          key: activeKeyId || razorpayKeyId,
          order_id: saved.providerOrderId,
          amount: saved.amount,
          currency: saved.currency,
          name: "indianXtrade",
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
      setOrder(result.order);
      if (outcome === "cancelled") {
        toast.info("Test payment cancelled.");
        router.push("/dashboard?view=explore");
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
      paying.current = false;
      if (provider === "mock") setBusy(false);
    }
  }
  async function applyCoupon() {
    setCouponBusy(true);
    setError("");
    try {
      const quote = await api("quote", { courseId: course.id, coupon: coupon.trim() });
      setCouponApplied({ code: coupon.trim(), discount: quote.discount });
    } catch (reason) {
      setCouponApplied(null);
      setError(reason instanceof Error ? reason.message : "Coupon could not be applied.");
    } finally {
      setCouponBusy(false);
    }
  }
  if (provider === "upi")
    return (
      <PaymentShell>
        <div className="ix-review-container">
          <PaymentBack href={`/courses/${course.slug}`}>Back to course</PaymentBack>
          <header className="ix-review-heading">
            <span className="ix-eyebrow">YOUR NEXT CHAPTER</span>
            <h1>Review your course.</h1>
            <p>One payment. {accessLabel(course)}.</p>
          </header>
          <div className="ix-review-grid">
            <CourseReview course={course} />
            <section className="ix-review-summary" aria-labelledby="ix-order-title">
              <h2 id="ix-order-title">Order summary</h2>
              {couponApplied && (
                <div className="ix-coupon-applied">
                  <Tag size={20} aria-hidden="true" />
                  <span>
                    <strong>{couponApplied.code}</strong> applied
                  </span>
                  <CheckCircle size={18} aria-hidden="true" />
                </div>
              )}
              <PaymentTotals
                base={order?.base ?? course.price}
                tax={order?.tax ?? tax}
                total={order?.amount ?? course.price - (couponApplied?.discount ?? 0) + tax}
                couponDiscount={couponApplied?.discount}
                couponCode={couponApplied?.code}
                gatewaySavings={order?.gatewaySavings}
              />
              <form
                className="ix-coupon-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (coupon.trim() && !couponBusy && !order) void applyCoupon();
                }}
              >
                <label htmlFor="ix-coupon">Have a coupon?</label>
                <div>
                  <input
                    id="ix-coupon"
                    value={coupon}
                    maxLength={32}
                    onChange={(event) => {
                      setCoupon(event.target.value.toUpperCase());
                      setCouponApplied(null);
                    }}
                    placeholder="Enter coupon code"
                    aria-label="Coupon code"
                    disabled={busy || couponBusy || !!order}
                  />
                  <button
                    className="ix-button ix-secondary"
                    type="submit"
                    disabled={!coupon.trim() || busy || couponBusy || !!order}
                  >
                    {couponBusy ? "Checking…" : "Apply"}
                  </button>
                </div>
                {couponApplied && (
                  <p className="ix-input-help">Coupon {couponApplied.code} applied.</p>
                )}
              </form>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void pay("paid");
                }}
                aria-busy={busy}
              >
                <label className="ix-terms">
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
                  <p className="ix-error" role="alert">
                    Payments temporarily unavailable
                  </p>
                )}
                {error && (
                  <p className="ix-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="ix-button ix-primary"
                  disabled={
                    !interactive || !terms || busy || !available || !!retryAt || setupBlocked
                  }
                >
                  {busy
                    ? "Preparing your gateway…"
                    : retryAt
                      ? "Payment setup pending…"
                      : order && !order.upi && order.status === "pending"
                        ? "Resume payment setup"
                        : "Continue to gateway"}
                  <ArrowRight size={20} aria-hidden="true" />
                </button>
                <p className="ix-gateway-explainer">
                  You’ll continue to <strong>IndianXTrade Gateway</strong> to see your exact UPI
                  amount and pay.
                </p>
                <p className="ix-secure-caption">
                  <LockSimple size={15} aria-hidden="true" />
                  Pay with UPI · Receipt included
                </p>
              </form>
              {order && (
                <p className="ix-order-reference">
                  Order reference: {order.id} ·{" "}
                  <Link href={`/indianxtrade-gateway/${order.id}`}>Check order status</Link>
                </p>
              )}
            </section>
          </div>
          <p className="ix-review-footer">
            <Clock size={17} aria-hidden="true" />
            Your {accessLabel(course)} begins after payment is confirmed.
          </p>
        </div>
      </PaymentShell>
    );
  return (
    <CheckoutLayout
      course={course}
      title={failed ? "Your payment was not completed" : undefined}
      basePaise={course.price}
      taxPaise={tax}
      discountPaise={order ? order.base + order.tax - order.amount : couponApplied?.discount}
      totalPaise={order?.amount ?? course.price - (couponApplied?.discount ?? 0) + tax}
      notice={provider === "mock" ? "TEST MODE: no real money is charged" : undefined}
      details={
        <>
          Course access: {course.accessPeriod}{" "}
          {course.accessPeriod === 1 ? course.accessUnit.slice(0, -1) : course.accessUnit} from
          successful payment. Access ends automatically; this is a one-time payment.
        </>
      }
      coupon={
        <div className="checkout-coupon">
          <p>Have a coupon?</p>
          <div className="checkout-coupon-row">
            <input
              value={coupon}
              maxLength={32}
              onChange={(event) => {
                setCoupon(event.target.value.toUpperCase());
                setCouponApplied(null);
              }}
              placeholder="Enter coupon code"
              aria-label="Coupon code"
              disabled={busy || couponBusy || !!order}
            />
            <button
              className="button button-secondary"
              type="button"
              disabled={!coupon.trim() || busy || couponBusy || !!order}
              onClick={async () => {
                setCouponBusy(true);
                setError("");
                try {
                  const quote = await api("quote", { courseId: course.id, coupon: coupon.trim() });
                  setCouponApplied({ code: coupon.trim(), discount: quote.discount });
                } catch (reason) {
                  setCouponApplied(null);
                  setError(
                    reason instanceof Error ? reason.message : "Coupon could not be applied.",
                  );
                } finally {
                  setCouponBusy(false);
                }
              }}
            >
              {couponBusy ? "Checking…" : "Apply"}
            </button>
          </div>
          {couponApplied ? (
            <p className="checkout-note">Coupon {couponApplied.code} applied.</p>
          ) : (
            <button
              className="text-link"
              type="button"
              disabled={busy || couponBusy || !!order}
              onClick={() => {
                setCoupon("");
                setCouponApplied(null);
              }}
            >
              I don’t have a coupon
            </button>
          )}
        </div>
      }
    >
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
      <h2 id="checkout-payment-title">Payment details</h2>
      <p className="checkout-section-description">
        Review the total and accept the policies to continue.
      </p>
      <div className="checkout-provider">
        <LockSimple size={22} aria-hidden="true" />
        <div>
          <strong>{provider === "mock" ? "Demo payment" : "Pay with Razorpay"}</strong>
          <p>
            {provider === "mock"
              ? "Try the checkout with a simulated payment."
              : "Choose your payment method in the payment window."}
          </p>
        </div>
      </div>
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
      <div className="checkout-payment-actions">
        <button
          className="button button-primary checkout-submit"
          onClick={() => void pay("paid")}
          disabled={
            !terms ||
            busy ||
            !available ||
            !!retryAt ||
            setupBlocked ||
            (provider === "razorpay" && !ready)
          }
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
                terms ? void pay("cancelled") : router.push("/dashboard?view=explore")
              }
            >
              Cancel
            </button>
          </>
        )}
      </div>
      <p className="checkout-payment-total">
        Total to pay{" "}
        <strong>
          {checkoutMoney(order?.amount ?? course.price - (couponApplied?.discount ?? 0) + tax)}
        </strong>
      </p>
      {failed && (
        <p className="checkout-cancel">
          <Link className="text-link" href="/dashboard?view=explore">
            ← Return to explore courses
          </Link>
        </p>
      )}
      {order && (
        <p className="checkout-note">
          Order reference: {order.id} ·{" "}
          <Link href={`/checkout/success?orderId=${order.id}`}>Check order status</Link>
        </p>
      )}
    </CheckoutLayout>
  );
}
