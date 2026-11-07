"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useHydrated } from "../lib/use-hydrated";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { toast } from "sonner";
import type { PurchaseCourse, PurchaseOrder } from "../../shared/purchase";
import { LockSimple } from "@phosphor-icons/react";
import { CheckoutLayout, checkoutMoney } from "./checkout-layout";
const UpiPaymentPanel = dynamic(() => import("./upi-payment-panel").then((m) => m.UpiPaymentPanel));
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
      let saved = order;
      let activeKeyId = razorpayKeyId;
      if (!saved || saved.status !== "pending") {
        const data = await api("create", {
          courseId: course.id,
          terms: true,
          ...(couponApplied ? { coupon: couponApplied.code } : {}),
        });
        saved = data.order as PurchaseOrder;
        activeKeyId = data.keyId;
        setOrder(saved);
        if (data.keyId) setRazorpayKeyId(data.keyId);
      }
      if (provider === "upi") {
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
      if (provider === "mock") setBusy(false);
    }
  }
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
      {provider === "upi" && order ? <UpiPaymentPanel order={order} /> : null}
      <div className="checkout-provider">
        <LockSimple size={22} aria-hidden="true" />
        <div>
          <strong>
            {provider === "mock"
              ? "Demo payment"
              : provider === "upi"
                ? "Pay with UPI"
                : "Pay with Razorpay"}
          </strong>
          <p>
            {provider === "mock"
              ? "Try the checkout with a simulated payment."
              : provider === "upi"
                ? "Scan a QR code or open your UPI app. Your bank confirms the payment automatically."
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
            (provider === "upi" && !!order) ||
            (provider === "razorpay" && !ready)
          }
        >
          {busy
            ? "Processing…"
            : provider === "mock"
              ? failed
                ? "Retry test payment"
                : "Pay successfully"
              : provider === "upi"
                ? "Generate UPI QR"
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
