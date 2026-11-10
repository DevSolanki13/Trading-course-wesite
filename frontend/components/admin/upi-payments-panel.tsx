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

  const [approvingPayment, setApprovingPayment] = useState<AdminUpiPayment | null>(null);
  const [approvalUtr, setApprovalUtr] = useState("");
  const [approvalReason, setApprovalReason] = useState("");
  const [approvalConfirmAmount, setApprovalConfirmAmount] = useState("");
  const [approvalBankChecked, setApprovalBankChecked] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalError, setApprovalError] = useState("");

  useEffect(() => {
    if (!approvingPayment) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !approvalBusy) {
        setApprovingPayment(null);
        setApprovalError("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [approvingPayment, approvalBusy]);

  function openApprovalModal(row: AdminUpiPayment) {
    setApprovingPayment(row);
    setApprovalUtr(row.utr || row.submittedReference || "");
    setApprovalReason("");
    setApprovalConfirmAmount((row.amount / 100).toString());
    setApprovalBankChecked(false);
    setApprovalError("");
  }

  function closeApprovalModal() {
    if (approvalBusy) return;
    setApprovingPayment(null);
    setApprovalError("");
  }

  async function handleManualApprove(e: React.FormEvent) {
    e.preventDefault();
    if (!approvingPayment) return;
    if (!approvingPayment.gatewayBound) {
      setApprovalError(
        "Checkout was never set up with the gateway for this order; nothing to approve.",
      );
      return;
    }
    const normalizedUtr = approvalUtr.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,32}$/.test(normalizedUtr)) {
      setApprovalError("UTR must be 6 to 32 uppercase alphanumeric characters.");
      return;
    }
    const trimmedReason = approvalReason.trim();
    if (trimmedReason.length < 10 || trimmedReason.length > 300) {
      setApprovalError("Reason must be between 10 and 300 characters.");
      return;
    }
    const parsedRupees = parseFloat(approvalConfirmAmount);
    if (isNaN(parsedRupees) || parsedRupees <= 0) {
      setApprovalError("Enter a valid confirmation amount in rupees.");
      return;
    }
    const confirmPaise = Math.round(parsedRupees * 100);
    if (confirmPaise !== approvingPayment.amount) {
      setApprovalError(
        `Confirmation amount must match order total (${money(approvingPayment.amount)}).`,
      );
      return;
    }
    setApprovalBusy(true);
    setApprovalError("");
    try {
      const res = await adminApi<{ message: string }>("upi-manual-approve", {
        id: approvingPayment.id,
        utr: normalizedUtr,
        reason: trimmedReason,
        confirmAmount: confirmPaise,
        bankChecked: approvalBankChecked,
      });
      setMessage(res.message);
      setApprovingPayment(null);
      reload();
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "Approval failed. Try again.");
    } finally {
      setApprovalBusy(false);
    }
  }
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
                <div className="admin-table-wrap admin-table-cards">
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
                                  <td data-label="Received">{when(row.receivedAt)}</td>
                                  <td data-label="Amount">{money(row.amount)}</td>
                                  <td data-label="UTR">
                                    <Reference value={row.utr} />
                                  </td>
                                  <td data-label="Action" className="admin-col-action">
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
                                  <td data-label="Student / course">
                                    <strong>{row.studentName || row.email}</strong>
                                    <small className="upi-cell-sub">{row.email}</small>
                                    <span className="upi-cell-sub">{row.course}</span>
                                    <small className="upi-cell-sub">Order {row.id}</small>
                                  </td>
                                  <td data-label="Amount">{money(row.amount)}</td>
                                  <td data-label="UTR">
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
                                  <td data-label="Created">{when(row.createdAt)}</td>
                                  <td data-label="Payment status">
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "6px",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <span className="admin-badge">{paymentState(row)}</span>
                                      {row.manualApproval && (
                                        <span className="admin-badge upi-manual-badge">Manual</span>
                                      )}
                                    </div>
                                    <span className="upi-cell-sub">
                                      {row.manualApproval
                                        ? `Approved by ${row.manualApproval.by} · ${when(row.manualApproval.at)} · ${row.manualApproval.reason}`
                                        : row.reviewReason || `Course order: ${row.status}`}
                                    </span>
                                  </td>
                                  <td data-label="Action" className="admin-col-action">
                                    <div className="upi-action-group">
                                      {row.status === "pending" && (
                                        <>
                                          {row.gatewayBound && (
                                            <button
                                              type="button"
                                              className="text-link"
                                              disabled={!!busy}
                                              onClick={() => check(row)}
                                            >
                                              {busy === row.id ? "Checking…" : "Check payment"}
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            className="button button-secondary upi-manual-approve-btn"
                                            disabled={!!busy}
                                            onClick={() => openApprovalModal(row)}
                                          >
                                            Approve manually
                                          </button>
                                        </>
                                      )}
                                      {row.status !== "pending" && (
                                        <a className="text-link" href={`/admin?view=orders`}>
                                          View orders
                                        </a>
                                      )}
                                    </div>
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

      {approvingPayment && (
        <div className="admin-modal-backdrop" onClick={() => !approvalBusy && closeApprovalModal()}>
          <div
            className="admin-modal-dialog upi-approval-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upi-approval-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="upi-approval-title" style={{ margin: "0 0 10px", fontSize: "17px" }}>
              Approve payment manually
            </h3>
            <div className="upi-approval-summary">
              <div>
                <strong>Student</strong>
                <span>{approvingPayment.studentName || approvingPayment.email}</span>
                <small className="upi-cell-sub">{approvingPayment.email}</small>
              </div>
              <div>
                <strong>Course</strong>
                <span>{approvingPayment.course}</span>
              </div>
              <div>
                <strong>Order ID</strong>
                <span className="upi-cell-sub">{approvingPayment.id}</span>
              </div>
              <div>
                <strong>Amount</strong>
                <span style={{ font: "15px var(--mono, monospace)", fontWeight: 600 }}>
                  {money(approvingPayment.amount)}
                </span>
              </div>
              <div>
                <strong>Student reference</strong>
                <span>{approvingPayment.submittedReference || "Not submitted"}</span>
              </div>
              <div>
                <strong>Gateway status</strong>
                <span>
                  {approvingPayment.gatewayBound
                    ? approvingPayment.gatewayStatus || "Pending"
                    : "Unbound checkout (no gateway order)"}
                </span>
              </div>
            </div>

            <div className="upi-approval-warning" role="note">
              <strong>Caution:</strong> This grants course access and sends the receipt. It can only
              be reversed by a refund.
            </div>

            {!approvingPayment.gatewayBound ? (
              <div>
                <p className="auth-error" role="alert">
                  Checkout was never set up with the gateway for this order. It cannot be manually
                  approved.
                </p>
                <div className="upi-approval-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={closeApprovalModal}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form
                aria-label="Manual approval form"
                className="upi-approval-form"
                onSubmit={handleManualApprove}
              >
                <label className="admin-form label">
                  Bank UTR / Reference
                  <input
                    value={approvalUtr}
                    onChange={(e) => setApprovalUtr(e.target.value.toUpperCase())}
                    placeholder="e.g. 123456789012"
                    maxLength={32}
                    required
                    autoFocus
                    disabled={approvalBusy}
                  />
                  <span className="admin-help">
                    6 to 32 uppercase alphanumeric characters from the bank credit.
                  </span>
                </label>

                <label className="admin-form label">
                  Reason for manual approval
                  <textarea
                    value={approvalReason}
                    onChange={(e) => setApprovalReason(e.target.value)}
                    placeholder="Explain why this payment is being manually approved (10–300 characters)"
                    minLength={10}
                    maxLength={300}
                    rows={3}
                    required
                    disabled={approvalBusy}
                  />
                  <span className="admin-help">
                    Recorded in the audit log and visible on the payment history row.
                  </span>
                </label>

                <label className="admin-form label">
                  Confirm order amount (in ₹)
                  <input
                    type="number"
                    step="0.01"
                    value={approvalConfirmAmount}
                    onChange={(e) => setApprovalConfirmAmount(e.target.value)}
                    placeholder={(approvingPayment.amount / 100).toString()}
                    required
                    disabled={approvalBusy}
                  />
                  <span className="admin-help">
                    Re-type exact amount in rupees: {(approvingPayment.amount / 100).toFixed(2)}
                  </span>
                </label>

                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={approvalBankChecked}
                    onChange={(e) => setApprovalBankChecked(e.target.checked)}
                    disabled={approvalBusy}
                  />
                  <span>I checked this payment in the bank statement</span>
                </label>

                {approvalError && (
                  <p className="auth-error" role="alert" style={{ margin: "4px 0 0" }}>
                    {approvalError}
                  </p>
                )}

                <div className="upi-approval-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={approvalBusy}
                    onClick={closeApprovalModal}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="button button-primary" disabled={approvalBusy}>
                    {approvalBusy ? "Approving…" : "Approve payment"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
