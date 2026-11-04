"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
export function CheckoutForm({
  course,
  totals,
  refundDays,
  refundWatchLimit,
  sandbox = false,
  initialPhone = "",
}: {
  course: { slug: string; title: string; description: string };
  totals: { basePaise: number; taxPaise: number; totalPaise: number };
  refundDays: number;
  refundWatchLimit: number;
  sandbox?: boolean;
  initialPhone?: string;
}) {
  const router = useRouter();
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState(initialPhone);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: course.slug, terms, ...(sandbox ? { phone } : {}) }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/checkout/${course.slug}`)}`);
        return;
      }
      if (data.code === "ALREADY_OWNED") {
        router.push(`/learn/${course.slug}`);
        return;
      }
      if (!response.ok) throw new Error(data.error || "Checkout could not start.");
      router.push(data.checkoutUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout could not start.");
      setBusy(false);
    }
  }
  return (
    <section className="checkout-card" aria-labelledby="checkout-title">
      <div className="demo-banner">
        {sandbox ? "CASHFREE SANDBOX — test payment only" : "DEMO MODE — no real payment"}
      </div>
      <h1 id="checkout-title">Review your course</h1>
      <div className="checkout-course">
        <div>
          <strong>{course.title}</strong>
          <p>{course.description}</p>
        </div>
      </div>
      <div className="checkout-lines">
        <div>
          <span>Course price</span>
          <strong>{money(totals.basePaise)}</strong>
        </div>
        <div>
          <span>GST</span>
          <strong>{money(totals.taxPaise)}</strong>
        </div>
        <div className="checkout-total">
          <span>Total</span>
          <strong>{money(totals.totalPaise)}</strong>
        </div>
      </div>
      <p>
        Refund window: {refundDays} days, with less than {refundWatchLimit}% watched. Read the
        policy for conditions.
      </p>
      {sandbox && (
        <div className="checkout-field">
          <label htmlFor="checkout-phone" className="checkout-field-label">
            Indian mobile number <span className="checkout-field-required">*</span>
          </label>
          <div className="checkout-phone-wrap">
            <span className="checkout-phone-prefix" aria-hidden="true">
              +91
            </span>
            <input
              id="checkout-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="9876543210"
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
              maxLength={10}
              aria-describedby="checkout-phone-help"
            />
            {phone.length > 0 && (
              <span className={`checkout-phone-count ${phone.length === 10 ? "valid" : ""}`}>
                {phone.length}/10
              </span>
            )}
          </div>
          <small id="checkout-phone-help" className="checkout-field-help">
            10-digit number (starts with 6, 7, 8, or 9). Required by Cashfree.
          </small>
        </div>
      )}
      <label className="terms-check">
        <input
          type="checkbox"
          checked={terms}
          onChange={(event) => setTerms(event.target.checked)}
        />
        <span>
          I agree to the <Link href="/terms">terms</Link>,{" "}
          <Link href="/privacy">privacy policy</Link> and{" "}
          <Link href="/refund-policy">refund policy</Link>.
        </span>
      </label>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button button-primary checkout-submit"
        disabled={!terms || busy || (sandbox && !/^[6-9][0-9]{9}$/.test(phone))}
        onClick={submit}
      >
        {busy
          ? "Preparing your order…"
          : sandbox && !phone
            ? "Enter mobile number to continue"
            : sandbox && !/^[6-9][0-9]{9}$/.test(phone)
              ? `Enter 10-digit mobile (${phone.length}/10)`
              : !terms
                ? "Accept terms to continue"
                : sandbox
                  ? "Continue to sandbox payment"
                  : "Continue to demo payment"}
      </button>
      <p className="checkout-note">
        No money will be collected. The next screen shows the saved order total before you confirm a
        {sandbox ? "sandbox outcome." : "simulated outcome."}
      </p>
    </section>
  );
}
