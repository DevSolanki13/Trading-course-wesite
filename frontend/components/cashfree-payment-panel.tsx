"use client";
import Script from "next/script";
import Link from "next/link";
import { useState } from "react";
type CashfreeWindow = Window & {
  Cashfree?: (options: { mode: "sandbox" }) => {
    checkout: (options: { paymentSessionId: string; redirectTarget: "_self" }) => Promise<unknown>;
  };
};
export function CashfreePaymentPanel({
  orderId,
  sessionId,
  totalPaise,
  nonce,
}: {
  orderId: string;
  sessionId: string;
  totalPaise: number;
  nonce?: string;
}) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function pay() {
    setBusy(true);
    setError("");
    try {
      const factory = (window as CashfreeWindow).Cashfree;
      if (!factory) throw new Error("The payment screen is unavailable. Reload and try again.");
      const result = await factory({ mode: "sandbox" }).checkout({
        paymentSessionId: sessionId,
        redirectTarget: "_self",
      });
      if (result && typeof result === "object" && "error" in result)
        throw new Error(
          "The payment screen could not open. Check your saved order before retrying.",
        );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Payment could not open.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="checkout-card" aria-labelledby="cashfree-heading">
      <Script
        src="https://sdk.cashfree.com/js/v3/cashfree.js"
        nonce={nonce}
        onReady={() => setReady(true)}
        onError={() =>
          setError(
            "The payment service could not load. Reload this page or check your saved order.",
          )
        }
      />
      <div className="demo-banner">CASHFREE SANDBOX — no real payment</div>
      <h1 id="cashfree-heading">Your saved checkout</h1>
      <p>
        Total:{" "}
        {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
          totalPaise / 100,
        )}
      </p>
      <p>Use Cashfree sandbox payment details. Your course opens only after server confirmation.</p>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <button className="button button-primary" onClick={pay} disabled={!ready || busy}>
        {busy ? "Opening payment…" : "Open sandbox payment"}
      </button>
      <p>
        <Link className="text-link" href={`/checkout/status/${orderId}`}>
          Check saved order status
        </Link>
      </p>
    </section>
  );
}
