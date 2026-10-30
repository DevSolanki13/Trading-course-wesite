"use client";
import { useEffect, useState } from "react";
import { adminApi, money } from "../../lib/admin-api";
type Overview = {
  gross: number;
  refunded: number;
  net: number;
  sales: number;
  refundRate: number;
  newStudents: number;
  pendingRefunds: number;
  chart: { day: string; total: number }[];
  courses: { title: string; sales: number; gross: number; net: number }[];
  limited: boolean;
};
export function OverviewPanel() {
  const [range, setRange] = useState("month");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    adminApi<Overview>(`overview?range=${range}`)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [range]);
  const max = Math.max(1, ...(data?.chart.map((d) => d.total) ?? []));
  return (
    <section>
      <div className="admin-section-head">
        <div>
          <h2>Overview</h2>
          <p>Confirmed sales only. Pending and failed payments are excluded from revenue.</p>
        </div>
        <label className="admin-range">
          Period
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="today">Today (IST)</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="all">All time</option>
          </select>
        </label>
      </div>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <p role="status">Loading business overview…</p>
      ) : (
        <>
          <div className="admin-metrics">
            {[
              ["Net revenue", money(data.net)],
              ["Gross sales", money(data.gross)],
              ["Confirmed refunds", money(data.refunded)],
              ["Paid sales", String(data.sales)],
              ["Refund rate", `${data.refundRate.toFixed(1)}%`],
              ["New accounts", String(data.newStudents)],
              ["Pending requests", String(data.pendingRefunds)],
            ].map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          {data.limited && (
            <p className="auth-message">
              Overview is limited to 10,000 confirmed orders for this period. Narrow the date range
              for complete totals.
            </p>
          )}
          <div className="admin-two-column">
            <section className="admin-panel">
              <h3>Revenue by payment day</h3>
              {data.chart.length ? (
                <div
                  className="admin-chart"
                  role="img"
                  aria-label={`Daily gross revenue: ${data.chart.map((d) => `${d.day} ${money(d.total)}`).join(", ")}`}
                >
                  {data.chart.map((d) => (
                    <div
                      key={d.day}
                      title={`${d.day}: ${money(d.total)}`}
                      style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}
                    >
                      <span className="sr-only">
                        {d.day}: {money(d.total)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No confirmed sales in this period.</p>
              )}
            </section>
            <section className="admin-panel">
              <h3>Course performance</h3>
              {data.courses.length ? (
                <div className="admin-stack">
                  {data.courses.map((c, i) => (
                    <div key={i}>
                      <strong>{c.title}</strong>
                      <span>
                        {c.sales} sales · {money(c.net)} net
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Course sales will appear here after verified payments.</p>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
