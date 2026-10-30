"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function DemoPaymentPanel({ orderId, totalPaise }: { orderId: string; totalPaise: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function simulate(status: "paid" | "failed" | "pending" | "cancelled") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/payments/demo/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The simulation could not be saved.");
      router.push(`/checkout/status/${orderId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Please retry.");
      setBusy(false);
    }
  }
  return (
    <section className="gateway-card">
      <div className="demo-banner">DEMO MODE — no real payment</div>
      <h1>Test your course checkout</h1>
      <p>
        Saved order total:{" "}
        <strong>
          {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
            totalPaise / 100,
          )}
        </strong>
      </p>
      <p>Choose a simulated result. No card, UPI details, or money are needed.</p>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <div className="gateway-actions">
        <button className="button button-primary" disabled={busy} onClick={() => simulate("paid")}>
          Simulate success
        </button>
        <button
          className="button button-secondary"
          disabled={busy}
          onClick={() => simulate("failed")}
        >
          Simulate failure
        </button>
        <button
          className="button button-secondary"
          disabled={busy}
          onClick={() => simulate("pending")}
        >
          Keep pending
        </button>
        <button className="text-link" disabled={busy} onClick={() => simulate("cancelled")}>
          Cancel checkout
        </button>
      </div>
      {busy && <p role="status">Saving the result…</p>}
    </section>
  );
}
