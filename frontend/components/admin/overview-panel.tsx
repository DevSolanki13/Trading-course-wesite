"use client";
import { useEffect, useState } from "react";
import { adminApi, money } from "../../lib/admin-api";
import { OverviewSkeleton } from "./admin-skeletons";
type Overview = {
  gross: number;
  refunded: number;
  net: number;
  sales: number;
  refundRate: number;
  newStudents: number;
  coursesCount: number;
  enrolledStudents: number;
  pendingRefunds: number;
  chart: { day: string; total: number }[];
  courses: { title: string; sales: number; gross: number; net: number }[];
  limited: boolean;
};
export function OverviewPanel() {
  const [range, setRange] = useState("month");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    let live = true;
    adminApi<Overview>(`overview?range=${range}`)
      .then((d) => {
        if (live) {
          setData(d);
          setError("");
          setLoading(false);
        }
      })
      .catch((e) => {
        if (live) {
          setError(e.message || "Could not load business metrics.");
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [range, reloadTrigger]);

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
          <select
            value={range}
            onChange={(e) => {
              setRange(e.target.value);
              setLoading(true);
              setError("");
            }}
          >
            <option value="today">Today (IST)</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="all">All time</option>
          </select>
        </label>
      </div>
      {error && (
        <div
          className="admin-error-box"
          style={{
            padding: "16px",
            background: "color-mix(in srgb, var(--surface) 95%, #ff4d4f)",
            border: "1px solid var(--danger, #ff4d4f)",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
          role="alert"
        >
          <p style={{ color: "var(--danger, #ff4d4f)", margin: "0 0 10px", fontSize: "14px" }}>
            {error}
          </p>
          <button
            type="button"
            className="button button-secondary button-sm"
            onClick={() => {
              setLoading(true);
              setError("");
              setReloadTrigger((v) => v + 1);
            }}
          >
            Retry loading
          </button>
        </div>
      )}
      {loading && !data ? (
        <OverviewSkeleton />
      ) : !data ? (
        <p>No overview data available. Check server connection.</p>
      ) : (
        <>
          <div className="admin-metrics">
            {[
              ["Net revenue", money(data.net)],
              ["Courses", String(data.coursesCount)],
              ["Enrolled students", String(data.enrolledStudents)],
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
