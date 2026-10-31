"use client";
import { useEffect, useState } from "react";
import { adminApi, operation, when } from "../../lib/admin-api";
import type { RefundRow } from "../../../shared/admin";
export function RefundsPanel({ role }: { role: "admin" | "support" }) {
  const [state, setState] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{
    items: RefundRow[];
    total: number;
    providerActionsAvailable?: boolean;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [current, setCurrent] = useState(0);
  async function load() {
    const d = await adminApi<{
      items: RefundRow[];
      total: number;
      providerActionsAvailable?: boolean;
    }>(`refunds?state=${state}&page=${page}`);
    setData(d);
  }
  useEffect(() => {
    let live = true;
    adminApi<{ items: RefundRow[]; total: number; providerActionsAvailable?: boolean }>(
      `refunds?state=${state}&page=${page}`,
    )
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [state, page, current]);
  async function decide(e: React.FormEvent<HTMLFormElement>, r: RefundRow) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError("");
    setMessage("");
    try {
      await operation("refund_decide", {
        id: r.id,
        version: r.version,
        decision: String(f.get("decision")),
        note: String(f.get("note") ?? "").trim(),
        goodwill: f.get("goodwill") === "on",
      });
      setSelected(null);
      setMessage(
        "Decision saved and audited. Approval awaits payment-provider processing; no refund was sent.",
      );
      await load();
      setCurrent((n) => n + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Decision failed.");
    } finally {
      setPending(false);
    }
  }
  async function goodwill(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError("");
    try {
      await operation("goodwill_request", {
        orderId: String(f.get("orderId")),
        note: String(f.get("note") ?? "").trim(),
      });
      setMessage("Exceptional request queued for review. No refund was sent.");
      setCurrent((n) => n + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Request failed.");
    } finally {
      setPending(false);
    }
  }
  async function processRefund(id: string) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await adminApi<{ message: string }>("refund-process", { id });
      setMessage(result.message);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Provider check failed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section>
      <div className="admin-section-head">
        <div>
          <h2>Refund review</h2>
          <p>
            Review current and request-time evidence. Approval queues an action; it does not move
            money.
          </p>
        </div>
        <label className="admin-range">
          State
          <select
            value={state}
            onChange={(e) => {
              setPage(0);
              setState(e.target.value);
            }}
          >
            <option value="">All requests</option>
            {["requested", "approved", "processing", "rejected", "failed", "refunded"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="auth-message">
          {message}
        </p>
      )}
      {data ? (
        <>
          <div className="admin-refund-list">
            {data.items.map((r) => (
              <article className="admin-panel" key={r.id}>
                <div className="admin-section-head">
                  <div>
                    <h3>Order {r.order_id}</h3>
                    <p>
                      Requested {when(r.created_at)} · {r.reason}
                    </p>
                  </div>
                  <span className="admin-badge">{r.state}</span>
                </div>
                <div className="admin-evidence">
                  <div>
                    <strong>When requested</strong>
                    <p>{r.requested_evidence?.reason}</p>
                    <small>
                      {r.requested_evidence?.watchedPercent !== undefined
                        ? `${Number(r.requested_evidence.watchedPercent).toFixed(2)}% watched`
                        : "No reliable snapshot"}
                    </small>
                  </div>
                  <div>
                    <strong>Now</strong>
                    <p>{r.current_evidence?.reason}</p>
                    <small>
                      {r.current_evidence?.watchedPercent !== undefined
                        ? `${Number(r.current_evidence.watchedPercent).toFixed(2)}% watched`
                        : "Support review required"}
                    </small>
                  </div>
                </div>
                {r.review_note && <p className="admin-help">Review note: {r.review_note}</p>}
                {data.providerActionsAvailable &&
                  role === "admin" &&
                  ["approved", "processing"].includes(r.state) && (
                    <button
                      className="button button-secondary"
                      disabled={pending}
                      onClick={() => processRefund(r.id)}
                    >
                      Process/check sandbox refund
                    </button>
                  )}
                {["requested", "failed"].includes(r.state) && (
                  <>
                    <button
                      className="text-link"
                      onClick={() => setSelected(selected === r.id ? null : r.id)}
                    >
                      Review request
                    </button>
                    {selected === r.id && (
                      <form className="admin-form" onSubmit={(e) => decide(e, r)}>
                        <label>
                          Decision
                          <select name="decision">
                            <option value="approve">Approve for provider processing</option>
                            <option value="reject">Reject with explanation</option>
                          </select>
                        </label>
                        <label>
                          Review note
                          <textarea name="note" required minLength={5} maxLength={1000} rows={3} />
                        </label>
                        {role === "admin" && (
                          <label className="admin-checkbox">
                            <input type="checkbox" name="goodwill" /> Exceptional goodwill override,
                            with a recorded reason
                          </label>
                        )}
                        <button className="button button-primary" disabled={pending}>
                          Save decision
                        </button>
                      </form>
                    )}
                  </>
                )}
              </article>
            ))}
          </div>
          {!data.items.length && (
            <div className="admin-empty">
              <h3>No refund requests in this state.</h3>
              <p>Requests will appear after an eligible paid order is submitted by its owner.</p>
            </div>
          )}
          <div className="admin-pagination">
            <span>{data.total} requests</span>
            <button disabled={!page} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button disabled={(page + 1) * 50 >= data.total} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </>
      ) : (
        <p role="status">Loading refund queue…</p>
      )}
      {role === "admin" && (
        <form className="admin-panel admin-form admin-exception" onSubmit={goodwill}>
          <h3>Exceptional request</h3>
          <p>
            Open a review for a confirmed paid order outside standard eligibility. A separate
            approval and provider processing are still required.
          </p>
          <label>
            Paid order ID
            <input name="orderId" required />
          </label>
          <label>
            Why review this order?
            <textarea name="note" minLength={5} maxLength={1000} required rows={3} />
          </label>
          <button className="button button-secondary" disabled={pending}>
            Create review request
          </button>
        </form>
      )}
    </section>
  );
}
