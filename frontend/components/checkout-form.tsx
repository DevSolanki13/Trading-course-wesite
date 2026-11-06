"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockSimple } from "@phosphor-icons/react";
import { CheckoutLayout, checkoutMoney } from "./checkout-layout";
import { useHydrated } from "../lib/use-hydrated";

function nationalPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.slice(0, 10);
}
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
  const interactive = useHydrated();
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState(() => nationalPhone(initialPhone));
  const validPhone = /^[6-9][0-9]{9}$/.test(phone);
  async function submit() {
    if (busy || !terms || (sandbox && !validPhone)) return;
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
    <CheckoutLayout
      course={course}
      {...totals}
      notice={
        sandbox
          ? "Cashfree sandbox · Test payment only. No money will be collected."
          : "Demo mode · No real payment. No money will be collected."
      }
      policy={
        <>
          <strong>{refundDays}-day refund window</strong>
          <p>
            Eligible with less than {refundWatchLimit}% watched.{" "}
            <Link href="/refund-policy">Read the refund policy</Link> for conditions.
          </p>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        aria-busy={busy}
      >
        <h2 id="checkout-payment-title">Payment details</h2>
        <p className="checkout-section-description">
          {sandbox
            ? "Add your mobile number to continue with Cashfree."
            : "Confirm your order to continue to demo payment."}
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
                onChange={(event) => setPhone(nationalPhone(event.target.value))}
                disabled={!interactive || busy}
                required
                pattern="[6-9][0-9]{9}"
                aria-invalid={phone.length > 0 && !validPhone}
                aria-describedby="checkout-phone-help"
              />
              {phone.length > 0 && (
                <span className={`checkout-phone-count ${validPhone ? "valid" : ""}`}>
                  {phone.length}/10
                </span>
              )}
            </div>
            <small id="checkout-phone-help" className="checkout-field-help">
              {phone.length > 0 && !validPhone
                ? "Enter a 10-digit Indian number starting with 6, 7, 8, or 9."
                : "10-digit Indian mobile number. Required by Cashfree."}
            </small>
          </div>
        )}
        <div className="checkout-provider">
          <LockSimple size={22} aria-hidden="true" />
          <div>
            <strong>{sandbox ? "Pay with Cashfree" : "Demo payment"}</strong>
            <p>
              {sandbox
                ? "Choose your payment method on the next screen."
                : "Review the saved order before confirming a simulated outcome."}
            </p>
          </div>
        </div>
        <label className="terms-check">
          <input
            type="checkbox"
            checked={terms}
            disabled={!interactive || busy}
            onChange={(event) => setTerms(event.target.checked)}
          />
          <span>
            I agree to the <Link href="/terms">terms</Link>,{" "}
            <Link href="/privacy">privacy policy</Link> and{" "}
            <Link href="/refund-policy">refund policy</Link>.
          </span>
        </label>
        {error && (
          <div className="checkout-error">
            <p className="auth-error" role="alert">
              {error}
            </p>
            <Link className="text-link" href="/dashboard?view=explore">
              Return to explore courses
            </Link>
          </div>
        )}
        <button
          className="button button-primary checkout-submit"
          type="submit"
          disabled={!interactive || !terms || busy || (sandbox && !validPhone)}
        >
          {busy ? "Preparing your order…" : `Continue to ${sandbox ? "sandbox" : "demo"} payment`}
          {!busy && <ArrowRight size={18} aria-hidden="true" />}
        </button>
        <p className="checkout-payment-total">
          Total to pay <strong>{checkoutMoney(totals.totalPaise)}</strong>
        </p>
        <div className="checkout-cancel">
          <Link className="text-link" href="/dashboard?view=explore">
            Cancel and back to explore courses
          </Link>
        </div>
        <p className="checkout-note">
          No money will be collected. The next screen shows the saved order total before you confirm
          a {sandbox ? "sandbox outcome." : "simulated outcome."}
        </p>
      </form>
    </CheckoutLayout>
  );
}
