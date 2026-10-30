"use client";
import { useState } from "react";
import type { RefundEvidence } from "../../shared/admin";
type RequestView = {
  id: string;
  state: string;
  reason: string;
  reviewNote: string | null;
  createdAt: string;
} | null;
export function StudentRefundControl({
  orderId,
  evidence,
  request,
}: {
  orderId: string;
  evidence: RefundEvidence;
  request: RequestView;
}) {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState(request?.state ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (status)
    return (
      <p className="learning-refund-status">
        Refund request: <strong>{status}</strong>.{" "}
        {status === "approved"
          ? "Provider processing is still pending; approval is not settlement."
          : (request?.reviewNote ?? "Review and updates are shown here.")}
      </p>
    );
  if (!evidence.valid)
    return (
      <p className="learning-refund-status">
        Refund request needs support review: {evidence.reason}
      </p>
    );
  return (
    <div className="learning-refund-control">
      <p>
        {evidence.reason}{" "}
        {evidence.watchedPercent !== undefined &&
          `${Number(evidence.watchedPercent).toFixed(2)}% watched.`}
      </p>
      {evidence.deadline && (
        <p>
          Request before{" "}
          {new Date(evidence.deadline).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST.
        </p>
      )}
      {evidence.eligible && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError("");
            try {
              const r = await fetch("/api/refunds", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId, reason }),
              });
              const d = await r.json();
              if (!r.ok) throw new Error(d.error);
              setStatus("requested");
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : "Request could not be sent.");
            } finally {
              setPending(false);
            }
          }}
        >
          <label>
            Why are you requesting a refund?
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={5}
              maxLength={2000}
              rows={3}
            />
          </label>
          <button className="button button-secondary" disabled={pending}>
            Submit refund request
          </button>
        </form>
      )}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
