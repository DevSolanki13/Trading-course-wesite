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
}: {
  course: { slug: string; title: string; description: string };
  totals: { basePaise: number; taxPaise: number; totalPaise: number };
  refundDays: number;
  refundWatchLimit: number;
}) {
  const router = useRouter();
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: course.slug, terms }),
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
      <div className="demo-banner">DEMO MODE — no real payment</div>
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
        disabled={!terms || busy}
        onClick={submit}
      >
        {busy ? "Preparing your order…" : "Continue to demo payment"}
      </button>
      <p className="checkout-note">
        No money will be collected. The next screen shows the saved order total before you confirm a
        simulated outcome.
      </p>
    </section>
  );
}
