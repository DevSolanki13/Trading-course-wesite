"use client";
import { useEffect, useState } from "react";
import { adminApi, money, when } from "../../lib/admin-api";
import type { AdminOrder, RefundEvidence } from "../../../shared/admin";
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
export function OrdersPanel({ role }: { role: "admin" | "support" }) {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [from,setFrom]=useState("");const[to,setTo]=useState("");const[courseId,setCourseId]=useState("");const[studentId,setStudentId]=useState("");const[courses,setCourses]=useState<{id:string;title:string}[]>([]);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ items: AdminOrder[]; total: number } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const params = new URLSearchParams({ page: String(page), status, q: search, from, to, courseId, userId:studentId });
  useEffect(()=>{adminApi<{courses:{id:string;title:string}[]}>("order-filters").then(d=>setCourses(d.courses)).catch(()=>{});},[]);
  useEffect(() => {
    let live = true;
    adminApi<{ items: AdminOrder[]; total: number }>(
      `orders?${new URLSearchParams({ page: String(page), status, q: search, from, to, courseId, userId:studentId })}`,
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
  }, [page, status, search,from,to,courseId,studentId]);
  async function open(id: string) {
    try {
      setDetail(await adminApi<Detail>(`order?id=${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order detail is unavailable.");
    }
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
      {role==="admin"&&<p className="admin-help">CSV contains up to 1,000 matching orders. Narrow the filters when exporting larger histories.</p>}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-filter-row">
        <label>From (IST)<input type="date" value={from} onChange={e=>{setPage(0);setFrom(e.target.value);}}/></label>
        <label>To (IST)<input type="date" value={to} onChange={e=>{setPage(0);setTo(e.target.value);}}/></label>
        <label>Course<select value={courseId} onChange={e=>{setPage(0);setCourseId(e.target.value);}}><option value="">All courses</option>{courses.map(c=><option value={c.id} key={c.id}>{c.title}</option>)}</select></label>
        <label>Student UUID<input value={studentId} onChange={e=>{setPage(0);setStudentId(e.target.value);}} placeholder="Optional student ID"/></label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
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
          <div className="admin-table-wrap">
            <table>
              <caption className="sr-only">All orders</caption>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Amount</th>
                  <th>State</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id}>
                    <td>{o.course_snapshot?.title || o.course_id}</td>
                    <td>{money(o.total_paise)}</td>
                    <td>
                      <span className="admin-badge">{o.status}</span>
                    </td>
                    <td>{when(o.created_at)}</td>
                    <td>
                      <button className="text-link" onClick={() => open(o.id)}>
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <span>{data.total} orders</span>
            <button disabled={!page} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button disabled={(page + 1) * 50 >= data.total} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </>
      ) : (
        <p role="status">Loading orders…</p>
      )}
      {detail && (
        <div className="admin-panel admin-detail">
          <div className="admin-section-head">
            <div>
              <h3>Order detail</h3>
              <p className="admin-break">{detail.order.id}</p>
            </div>
            <button className="text-link" onClick={() => setDetail(null)}>
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
          <p className="admin-help">
            Invoice resend and provider reconciliation become available with Cashfree Phase 3.
          </p>
        </div>
      )}
    </section>
  );
}
