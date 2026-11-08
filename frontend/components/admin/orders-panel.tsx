"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { adminApi, money, when } from "../../lib/admin-api";
import type { AdminOrder, RefundEvidence } from "../../../shared/admin";
import { TableSkeleton } from "./admin-skeletons";
type Detail = {
  order: AdminOrder & {
    base_paise: number;
    discount_paise: number;
    tax_paise: number;
    gst_enabled: boolean;
    gst_rate_bps: number;
    refund_policy_snapshot: unknown;
  };
  payments: { id: string; status: string; amount_paise: number; provider_payment_id: string }[];
  evidence: RefundEvidence;
  providerActionsAvailable: boolean;
};

function OrderDetail({
  detail,
  role,
  providerBusy,
  onClose,
  onReconcile,
}: {
  detail: Detail;
  role: "admin" | "support";
  providerBusy: boolean;
  onClose: () => void;
  onReconcile: () => void;
}) {
  return (
    <div className="admin-panel admin-detail">
      <div className="admin-section-head">
        <div>
          <h3>Order detail</h3>
          <p className="admin-break">{detail.order.id}</p>
        </div>
        <button className="text-link" onClick={onClose}>
          Close
        </button>
      </div>
      <dl className="admin-facts">
        <dt>Student</dt>
        <dd className="admin-break">{detail.order.user_id}</dd>
        <dt>Course</dt>
        <dd>{detail.order.course_snapshot?.title || detail.order.course_id}</dd>
        <dt>Status</dt>
        <dd>{detail.order.status}</dd>
        <dt>Provider order</dt>
        <dd className="admin-break">{detail.order.provider_order_id || "Not created"}</dd>
        <dt>Base</dt>
        <dd>{money(detail.order.base_paise)}</dd>
        <dt>Discount</dt>
        <dd>{money(detail.order.discount_paise)}</dd>
        <dt>Tax</dt>
        <dd>{money(detail.order.tax_paise)}</dd>
        <dt>Total</dt>
        <dd>{money(detail.order.total_paise)}</dd>
        <dt>Confirmed at</dt>
        <dd>{when(detail.order.paid_at)}</dd>
      </dl>
      <h4>Payment attempts</h4>
      {detail.payments.length ? (
        detail.payments.map((p) => (
          <p key={p.id}>
            {p.status} · {money(p.amount_paise)} · {p.provider_payment_id}
          </p>
        ))
      ) : (
        <p>No payment attempts recorded.</p>
      )}
      <h4>Refund eligibility</h4>
      <p>{detail.evidence.reason}</p>
      {detail.providerActionsAvailable && role === "admin" && (
        <button className="button button-secondary" onClick={onReconcile} disabled={providerBusy}>
          {providerBusy ? "Checking provider…" : "Reconcile sandbox payment"}
        </button>
      )}
      <p className="admin-help">
        Billing documents are generated with confirmed payment. Provider actions require sandbox
        configuration and verified Admin MFA.
      </p>
    </div>
  );
}

function OrderDetailRow({
  detail,
  role,
  providerBusy,
  onClose,
  onReconcile,
}: {
  detail: Detail | null;
  role: "admin" | "support";
  providerBusy: boolean;
  onClose: () => void;
  onReconcile: () => void;
}) {
  // Retain this row's content during exit, independently of the next selected row.
  const [snapshot, setSnapshot] = useState({ source: detail, retained: detail });
  if (snapshot.source !== detail)
    setSnapshot({ source: detail, retained: detail ?? snapshot.retained });

  useEffect(() => {
    if (detail || !snapshot.retained) return;
    const timer = setTimeout(
      () => setSnapshot((current) => (current.source ? current : { ...current, retained: null })),
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 320,
    );
    return () => clearTimeout(timer);
  }, [detail, snapshot.retained]);

  if (!snapshot.retained) return null;
  return (
    <tr className="admin-order-detail-row">
      <td colSpan={5}>
        <div
          id={`order-detail-${snapshot.retained.order.id}`}
          className={`admin-order-detail-shell ${detail ? "is-open" : "is-closing"}`}
          inert={!detail}
          onTransitionEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              event.propertyName === "grid-template-rows" &&
              !detail
            )
              setSnapshot((current) => (current.source ? current : { ...current, retained: null }));
          }}
        >
          <div className="admin-order-detail-clip">
            <OrderDetail
              detail={snapshot.retained}
              role={role}
              providerBusy={providerBusy}
              onClose={onClose}
              onReconcile={onReconcile}
            />
          </div>
        </div>
      </td>
    </tr>
  );
}

export function OrdersPanel({ role }: { role: "admin" | "support" }) {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [courseId, setCourseId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{
    items: AdminOrder[];
    total: number;
    queryKey: string;
  } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const selection = useRef<{ version: number; id: string | null }>({ version: 0, id: null });
  const [error, setError] = useState("");
  const [failedQuery, setFailedQuery] = useState<string | null>(null);
  const [retryRequest, setRetryRequest] = useState(0);
  const [providerBusy, setProviderBusy] = useState(false);
  useEffect(() => {
    return () => {
      selection.current = { version: selection.current.version + 1, id: null };
    };
  }, []);
  async function reconcile() {
    if (!detail || providerBusy) return;
    const selected = selection.current;
    setProviderBusy(true);
    setError("");
    try {
      await adminApi("cashfree-reconcile", { id: detail.order.id });
      const updated = await adminApi<Detail>(`order?id=${detail.order.id}`);
      if (selection.current === selected) setDetail(updated);
    } catch (reason) {
      if (selection.current === selected)
        setError(reason instanceof Error ? reason.message : "Provider check failed.");
    } finally {
      setProviderBusy(false);
    }
  }
  const params = new URLSearchParams({
    page: String(page),
    status,
    q: search,
    from,
    to,
    courseId,
    userId: studentId,
  });
  const queryKey = params.toString();
  const refreshing = data?.queryKey !== queryKey;
  useEffect(() => {
    adminApi<{ courses: { id: string; title: string }[] }>("order-filters")
      .then((d) => setCourses(d.courses))
      .catch(() => {});
  }, []);
  useEffect(() => {
    let live = true;
    adminApi<{ items: AdminOrder[]; total: number }>(`orders?${queryKey}`)
      .then((d) => {
        if (live) {
          setData({ ...d, queryKey });
          setError("");
          setFailedQuery(null);
        }
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          setFailedQuery(queryKey);
        }
      });
    return () => {
      live = false;
    };
  }, [queryKey, retryRequest]);
  async function open(id: string) {
    const selected = { version: selection.current.version + 1, id };
    selection.current = selected;
    setLoadingId(id);
    setError("");
    // Do not collapse/restart an already open row while its data is refreshed.
    setDetail((current) => (current?.order.id === id ? current : null));
    try {
      const nextDetail = await adminApi<Detail>(`order?id=${id}`);
      if (selection.current === selected) setDetail(nextDetail);
    } catch (e) {
      if (selection.current === selected)
        setError(e instanceof Error ? e.message : "Order detail is unavailable.");
    } finally {
      if (selection.current === selected) setLoadingId(null);
    }
  }
  function closeDetail(restoreFocus = false) {
    const id = selection.current.id;
    selection.current = { version: selection.current.version + 1, id: null };
    setDetail(null);
    setLoadingId(null);
    if (restoreFocus && id)
      document.getElementById(`order-trigger-${id}`)?.focus({ preventScroll: true });
  }
  return (
    <section>
      <div className="admin-section-head">
        <div>
          <h2>Orders</h2>
          <p>Payment state is recorded here; redirects alone never grant course access.</p>
        </div>
        {role === "admin" && (
          <a className="button button-secondary" href={`/api/admin/export?${params}`}>
            Export CSV
          </a>
        )}
      </div>
      {role === "admin" && (
        <p className="admin-help">
          CSV contains up to 1,000 matching orders. Narrow the filters when exporting larger
          histories.
        </p>
      )}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {failedQuery === queryKey && (
        <button
          type="button"
          className="button button-secondary"
          onClick={() => {
            setFailedQuery(null);
            setError("");
            setRetryRequest((attempt) => attempt + 1);
          }}
        >
          Retry orders
        </button>
      )}
      <div className="admin-filter-row">
        <label>
          From (IST)
          <input
            type="date"
            value={from}
            onChange={(e) => {
              closeDetail();
              setPage(0);
              setFrom(e.target.value);
            }}
          />
        </label>
        <label>
          To (IST)
          <input
            type="date"
            value={to}
            onChange={(e) => {
              closeDetail();
              setPage(0);
              setTo(e.target.value);
            }}
          />
        </label>
        <label>
          Course
          <select
            value={courseId}
            onChange={(e) => {
              closeDetail();
              setPage(0);
              setCourseId(e.target.value);
            }}
          >
            <option value="">All courses</option>
            {courses.map((c) => (
              <option value={c.id} key={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Student UUID
          <input
            value={studentId}
            onChange={(e) => {
              closeDetail();
              setPage(0);
              setStudentId(e.target.value);
            }}
            placeholder="Optional student ID"
          />
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              closeDetail();
              setPage(0);
              setStatus(e.target.value);
            }}
          >
            <option value="">All states</option>
            {["pending", "paid", "failed", "cancelled", "refunded"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <form
          className="admin-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            closeDetail();
            setPage(0);
            setSearch(query.trim());
          }}
        >
          <label>
            Order or provider ID
            <input value={query} maxLength={100} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button className="button button-secondary">Search</button>
        </form>
      </div>
      {data ? (
        <>
          {refreshing && failedQuery !== queryKey && <p role="status">Refreshing orders…</p>}
          <div className="admin-table-wrap" aria-busy={refreshing && failedQuery !== queryKey}>
            <table>
              <caption className="sr-only">All orders</caption>
              <colgroup>
                <col style={{ width: "36%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Amount</th>
                  <th>State</th>
                  <th>Date</th>
                  <th className="admin-col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <Fragment key={o.id}>
                    <tr>
                      <td>{o.course_snapshot?.title || o.course_id}</td>
                      <td>{money(o.total_paise)}</td>
                      <td>
                        <span className="admin-badge">{o.status}</span>
                      </td>
                      <td>{when(o.created_at)}</td>
                      <td className="admin-col-action">
                        <button
                          id={`order-trigger-${o.id}`}
                          className="text-link"
                          aria-expanded={detail?.order.id === o.id}
                          aria-controls={
                            detail?.order.id === o.id ? `order-detail-${o.id}` : undefined
                          }
                          aria-busy={loadingId === o.id}
                          disabled={refreshing}
                          onClick={() => open(o.id)}
                        >
                          {loadingId === o.id ? "Loading…" : "Details"}
                        </button>
                      </td>
                    </tr>
                    <OrderDetailRow
                      detail={detail?.order.id === o.id ? detail : null}
                      role={role}
                      providerBusy={providerBusy}
                      onClose={() => closeDetail(true)}
                      onReconcile={reconcile}
                    />
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <span>{data.total} orders</span>
            <button
              disabled={!page || refreshing}
              onClick={() => {
                closeDetail();
                setPage(page - 1);
              }}
            >
              Previous
            </button>
            <button
              disabled={refreshing || (page + 1) * 50 >= data.total}
              onClick={() => {
                closeDetail();
                setPage(page + 1);
              }}
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <TableSkeleton columns={["36%", "16%", "14%", "22%", "12%"]} rows={6} />
      )}
    </section>
  );
}
