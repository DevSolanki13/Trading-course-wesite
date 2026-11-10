"use client";
import { useEffect, useState } from "react";
import { adminApi, money, when } from "../../lib/admin-api";
import type { AdminUpiCredit, AdminUpiPayment, AdminUpiPayments } from "../../../shared/admin";

type Tab = "review" | "unmatched" | "history";
const tabs = [
  { id: "review", label: "Needs review" },
  { id: "unmatched", label: "Unmatched credits" },
  { id: "history", label: "History" },
] as const;
function Reference({ value }: { value: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="admin-help">Not recorded</span>;
  return (
    <div className="upi-reference">
      <span>{value}</span>
      <button
        type="button"
        className="text-link"
        aria-label={`Copy UTR ${value}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
const paymentState = (row: AdminUpiPayment) =>
  row.status !== "pending"
    ? row.status
    : row.gatewayStatus?.replaceAll("_", " ").toLowerCase() || row.status;
export function UpiPaymentsPanel() {
  const [tab, setTab] = useState<Tab>("review");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<AdminUpiPayments | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    adminApi<AdminUpiPayments>(
      `upi-payments?${new URLSearchParams({ tab, q: search, page: String(page) })}`,
    )
      .then((result) => {
        if (live) {
          setData(result);
          setLoadedAt(Date.now());
          setError("");
        }
      })
      .catch((reason) => {
        if (live) setError(reason.message || "Payments could not be loaded. Try refreshing.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [tab, search, page, revision]);
  function reload() {
    setLoading(true);
    setData(null);
    setRevision((value) => value + 1);
  }
  function choose(next: Tab) {
    setTab(next);
    setPage(0);
    setQuery("");
    setSearch("");
    setData(null);
    setLoading(true);
    setError("");
    setMessage("");
  }
  async function check(row: AdminUpiPayment) {
    setBusy(row.id);
    setError("");
    setMessage("");
    try {
      const result = await adminApi<{ message: string }>("upi-check", { id: row.id });
      setMessage(result.message);
      reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Payment check failed. Try again.");
    } finally {
      setBusy(null);
    }
  }
  const stale = !data?.syncedAt || (!data.preview && loadedAt - Date.parse(data.syncedAt) > 180000);
  return (
    <section className="upi-payments">
      <div className="admin-section-head">
        <div>
          <h2>UPI payments</h2>
          <p>Course payments, bank credits that need a match, and payment history.</p>
        </div>
        <button
          type="button"
          className="button button-secondary"
          disabled={loading || !!busy}
          onClick={reload}
        >
          Refresh
        </button>
      </div>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="admin-help">
          {message}
        </p>
      )}
      <div className="admin-panel upi-payment-card">
        <div className="admin-tabs upi-payment-tabs" role="tablist" aria-label="Payment views">
          {tabs.map((item) => (
            <button
              key={item.id}
              id={`upi-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              aria-controls="upi-payment-results"
              tabIndex={tab === item.id ? 0 : -1}
              onKeyDown={(event) => {
                const index = tabs.findIndex((entry) => entry.id === item.id);
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % tabs.length
                    : event.key === "ArrowLeft"
                      ? (index + tabs.length - 1) % tabs.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : -1;
                if (next < 0) return;
                event.preventDefault();
                choose(tabs[next].id);
                document.getElementById(`upi-tab-${tabs[next].id}`)?.focus();
              }}
              className={tab === item.id ? "is-active" : ""}
              onClick={() => choose(item.id)}
            >
              {item.label}
              {item.id !== "history" && data ? (
                <span className="admin-badge">{data.counts[item.id]}</span>
              ) : null}
            </button>
          ))}
        </div>
        <p className="admin-help upi-payment-description">
          {tab === "unmatched"
            ? "Credits received in the shared collection account with no matching payment. They may belong to Academy or IndianXtrade; verify the payer before assigning them."
            : tab === "review"
              ? "Payments needing attention. Checking a payment grants course access only after the gateway confirms it. Search also finds other Academy UPI orders."
              : "Academy UPI payment history. Search by UTR, student, course, order number or amount."}
        </p>
        {data && (
          <p
            className={`admin-help upi-sync-status${stale ? " upi-sync-stale" : ""}`}
            role={stale ? "status" : undefined}
          >
            {data.preview && data.syncedAt
              ? `Local preview. Saved bank records from ${when(data.syncedAt)}.`
              : data.syncedAt
                ? `Bank records last updated ${when(data.syncedAt)}.${stale ? " Updates are delayed; refresh again shortly." : " Updated about every minute."}`
                : "Bank records have not synced yet. Refresh again shortly; the queue is not confirmed clear."}
          </p>
        )}
        <form
          className="admin-inline-form upi-payment-search"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(query.trim());
            setPage(0);
            setData(null);
            setLoading(true);
            setRevision((value) => value + 1);
          }}
        >
          <label className="sr-only" htmlFor="upi-payment-search">
            Search payments
          </label>
          <input
            id="upi-payment-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              tab === "unmatched"
                ? "Search UTR or amount"
                : "Search UTR, student, course, order or amount"
            }
          />
          <button className="button button-secondary">Search</button>
          {search && (
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setQuery("");
                setSearch("");
                setPage(0);
                reload();
              }}
            >
              Clear search
            </button>
          )}
        </form>
        <div
          id="upi-payment-results"
          role="tabpanel"
          aria-labelledby={`upi-tab-${tab}`}
          aria-busy={loading}
        >
          {loading ? (
            <p role="status" className="admin-help">
              Loading payments…
            </p>
          ) : (
            data && (
              <>
                <div className="admin-table-wrap">
                  <table>
                    <caption className="sr-only">
                      {tabs.find((item) => item.id === tab)?.label} — UPI only
                    </caption>
                    <thead>
                      <tr>
                        {tab === "unmatched" ? (
                          <>
                            <th>Received</th>
                            <th>Amount</th>
                            <th>UTR</th>
                            <th>Action</th>
                          </>
                        ) : (
                          <>
                            <th>Student / course</th>
                            <th>Amount</th>
                            <th>UTR</th>
                            <th>Created</th>
                            <th>Payment status</th>
                            <th>Action</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item) =>
                        tab === "unmatched"
                          ? (() => {
                              const row = item as AdminUpiCredit;
                              return (
                                <tr key={row.id}>
                                  <td>{when(row.receivedAt)}</td>
                                  <td>{money(row.amount)}</td>
                                  <td>
                                    <Reference value={row.utr} />
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="text-link"
                                      onClick={() => {
                                        const term = (row.amount / 100).toFixed(2);
                                        choose("review");
                                        setQuery(term);
                                        setSearch(term);
                                      }}
                                    >
                                      Find Academy orders
                                    </button>
                                  </td>
                                </tr>
                              );
                            })()
                          : (() => {
                              const row = item as AdminUpiPayment;
                              return (
                                <tr key={row.id}>
                                  <td>
                                    <strong>{row.studentName || row.email}</strong>
                                    <small className="upi-cell-sub">{row.email}</small>
                                    <span className="upi-cell-sub">{row.course}</span>
                                    <small className="upi-cell-sub">Order {row.id}</small>
                                  </td>
                                  <td>{money(row.amount)}</td>
                                  <td>
                                    <Reference value={row.utr} />
                                    {row.submittedReference && (
                                      <div className="upi-cell-sub">
                                        <small>Student reference · unverified</small>
                                        <Reference value={row.submittedReference} />
                                        {row.referenceSubmittedAt && (
                                          <small>{when(row.referenceSubmittedAt)}</small>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td>{when(row.createdAt)}</td>
                                  <td>
                                    <span className="admin-badge">{paymentState(row)}</span>
                                    <span className="upi-cell-sub">
                                      {row.reviewReason || `Course order: ${row.status}`}
                                    </span>
                                  </td>
                                  <td>
                                    {row.status === "pending" && row.gatewayBound ? (
                                      <button
                                        type="button"
                                        className="text-link"
                                        disabled={!!busy}
                                        onClick={() => check(row)}
                                      >
                                        {busy === row.id ? "Checking…" : "Check payment"}
                                      </button>
                                    ) : (
                                      <a className="text-link" href={`/admin?view=orders`}>
                                        View orders
                                      </a>
                                    )}
                                  </td>
                                </tr>
                              );
                            })(),
                      )}
                      {!data.items.length && (
                        <tr>
                          <td colSpan={tab === "unmatched" ? 4 : 6} className="admin-help">
                            {search
                              ? "No payments match this search."
                              : tab === "review"
                                ? "No Academy payments currently need review."
                                : tab === "history"
                                  ? "No UPI payment history yet."
                                  : !stale
                                    ? "No unmatched credits in the latest bank records."
                                    : "No credits to display. Bank sync is pending or delayed."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="admin-pagination">
                  <span>
                    {data.total} {tab === "unmatched" ? "credits" : "payments"}
                    {search ? " matching this search" : ""}
                  </span>
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => {
                      setPage((value) => value - 1);
                      setLoading(true);
                      setData(null);
                    }}
                  >
                    Previous
                  </button>
                  <span>Page {page + 1}</span>
                  <button
                    type="button"
                    disabled={(page + 1) * 25 >= data.total}
                    onClick={() => {
                      setPage((value) => value + 1);
                      setLoading(true);
                      setData(null);
                    }}
                  >
                    Next
                  </button>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </section>
  );
}
