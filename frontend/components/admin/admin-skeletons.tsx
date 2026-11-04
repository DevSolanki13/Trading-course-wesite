import React from "react";

export function AdminSectionHeadSkeleton({
  titleWidth = 180,
  descWidth = 340,
}: {
  titleWidth?: number;
  descWidth?: number;
}) {
  return (
    <div className="admin-section-head" style={{ marginBottom: 20 }}>
      <div>
        <div
          className="admin-skeleton admin-skeleton-title"
          style={{ width: titleWidth }}
          aria-hidden="true"
        />
        <div
          className="admin-skeleton admin-skeleton-desc"
          style={{ width: descWidth, marginBottom: 0 }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <section aria-label="Loading overview metrics" role="status">
      <AdminSectionHeadSkeleton titleWidth={160} descWidth={440} />
      <div className="admin-skeleton-metrics">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="admin-skeleton-metric-card">
            <div
              className="admin-skeleton admin-skeleton-text"
              style={{ width: "60%" }}
              aria-hidden="true"
            />
            <div
              className="admin-skeleton"
              style={{ height: 28, width: "75%", borderRadius: 6 }}
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
      <div className="admin-two-column">
        <div className="admin-panel" style={{ minHeight: 260 }}>
          <div
            className="admin-skeleton admin-skeleton-title"
            style={{ width: 180, marginBottom: 20 }}
          />
          <div className="admin-skeleton" style={{ height: 180, width: "100%", borderRadius: 8 }} />
        </div>
        <div className="admin-panel" style={{ minHeight: 260 }}>
          <div
            className="admin-skeleton admin-skeleton-title"
            style={{ width: 180, marginBottom: 20 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingBottom: 10,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div className="admin-skeleton admin-skeleton-text" style={{ width: "50%" }} />
                <div className="admin-skeleton admin-skeleton-text" style={{ width: "25%" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CoursesSkeleton() {
  return (
    <section aria-label="Loading course curriculum" role="status">
      <AdminSectionHeadSkeleton titleWidth={140} descWidth={380} />
      <div className="admin-skeleton-card-list">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="admin-skeleton-horizontal-card">
            <div className="admin-skeleton admin-skeleton-thumb" />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div
                className="admin-skeleton admin-skeleton-title"
                style={{ width: "45%", marginBottom: 8 }}
              />
              <div
                className="admin-skeleton admin-skeleton-text"
                style={{ width: "80%", marginBottom: 6 }}
              />
              <div className="admin-skeleton admin-skeleton-text" style={{ width: "35%" }} />
            </div>
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              <div style={{ width: 80 }}>
                <div
                  className="admin-skeleton admin-skeleton-text"
                  style={{ width: "80%", marginBottom: 6 }}
                />
                <div className="admin-skeleton admin-skeleton-text" style={{ width: "100%" }} />
              </div>
              <div style={{ width: 80 }}>
                <div
                  className="admin-skeleton admin-skeleton-text"
                  style={{ width: "80%", marginBottom: 6 }}
                />
                <div className="admin-skeleton admin-skeleton-text" style={{ width: "100%" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="admin-skeleton" style={{ width: 80, height: 32, borderRadius: 6 }} />
              <div className="admin-skeleton" style={{ width: 60, height: 32, borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TableSkeleton({
  columns = ["40%", "25%", "15%", "10%"],
  rows = 5,
}: {
  columns?: string[];
  rows?: number;
}) {
  return (
    <div className="admin-skeleton-table-wrap" role="status" aria-label="Loading table data">
      <div className="admin-skeleton-table-head">
        {columns.map((w, i) => (
          <div
            key={i}
            className="admin-skeleton admin-skeleton-text"
            style={{ width: w, height: 16 }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="admin-skeleton-table-row">
          {columns.map((w, c) => (
            <div
              key={c}
              className="admin-skeleton admin-skeleton-text"
              style={{
                width: w,
                opacity: c === 0 ? 0.9 : 0.6,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StudentsSkeleton() {
  return (
    <section aria-label="Loading student accounts" role="status">
      <AdminSectionHeadSkeleton titleWidth={150} descWidth={360} />
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div className="admin-skeleton" style={{ width: 280, height: 38, borderRadius: 6 }} />
        <div className="admin-skeleton" style={{ width: 85, height: 38, borderRadius: 6 }} />
      </div>
      <TableSkeleton columns={["30%", "30%", "15%", "15%"]} rows={6} />
    </section>
  );
}

export function OrdersSkeleton() {
  return (
    <section aria-label="Loading orders" role="status">
      <AdminSectionHeadSkeleton titleWidth={120} descWidth={420} />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="admin-skeleton"
            style={{ width: 140, height: 38, borderRadius: 6 }}
          />
        ))}
      </div>
      <TableSkeleton columns={["35%", "20%", "20%", "15%"]} rows={6} />
    </section>
  );
}

export function RefundsSkeleton() {
  return (
    <section aria-label="Loading refund requests" role="status">
      <AdminSectionHeadSkeleton titleWidth={180} descWidth={440} />
      <div className="admin-skeleton-card-list">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="admin-panel" style={{ padding: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div className="admin-skeleton admin-skeleton-title" style={{ width: 200 }} />
              <div className="admin-skeleton" style={{ width: 90, height: 26, borderRadius: 14 }} />
            </div>
            <div
              className="admin-skeleton admin-skeleton-text"
              style={{ width: "70%", marginBottom: 10 }}
            />
            <div
              className="admin-skeleton admin-skeleton-text"
              style={{ width: "50%", marginBottom: 20 }}
            />
            <div style={{ display: "flex", gap: 12 }}>
              <div className="admin-skeleton" style={{ width: 100, height: 34, borderRadius: 6 }} />
              <div className="admin-skeleton" style={{ width: 100, height: 34, borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CouponsSkeleton() {
  return (
    <section aria-label="Loading coupon codes" role="status">
      <AdminSectionHeadSkeleton titleWidth={140} descWidth={400} />
      <div className="admin-two-column">
        <div className="admin-panel admin-form" style={{ padding: 24 }}>
          <div
            className="admin-skeleton admin-skeleton-title"
            style={{ width: 160, marginBottom: 20 }}
          />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div
                className="admin-skeleton admin-skeleton-text"
                style={{ width: "40%", marginBottom: 8 }}
              />
              <div
                className="admin-skeleton"
                style={{ width: "100%", height: 38, borderRadius: 6 }}
              />
            </div>
          ))}
        </div>
        <div className="admin-panel" style={{ padding: 24 }}>
          <div
            className="admin-skeleton admin-skeleton-title"
            style={{ width: 160, marginBottom: 20 }}
          />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: "14px 0",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ width: "65%" }}>
                <div
                  className="admin-skeleton admin-skeleton-text"
                  style={{ width: "50%", marginBottom: 6 }}
                />
                <div className="admin-skeleton admin-skeleton-text" style={{ width: "85%" }} />
              </div>
              <div className="admin-skeleton" style={{ width: 50, height: 28, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AnnouncementsSkeleton() {
  return (
    <section aria-label="Loading announcements" role="status">
      <AdminSectionHeadSkeleton titleWidth={190} descWidth={420} />
      <div className="admin-two-column">
        <div className="admin-panel admin-form" style={{ padding: 24 }}>
          <div
            className="admin-skeleton admin-skeleton-title"
            style={{ width: 180, marginBottom: 20 }}
          />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div
                className="admin-skeleton admin-skeleton-text"
                style={{ width: "35%", marginBottom: 8 }}
              />
              <div
                className="admin-skeleton"
                style={{ width: "100%", height: 40, borderRadius: 6 }}
              />
            </div>
          ))}
        </div>
        <div className="admin-panel" style={{ padding: 24 }}>
          <div
            className="admin-skeleton admin-skeleton-title"
            style={{ width: 180, marginBottom: 20 }}
          />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: "16px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                className="admin-skeleton admin-skeleton-text"
                style={{ width: "60%", marginBottom: 8 }}
              />
              <div
                className="admin-skeleton admin-skeleton-text"
                style={{ width: "90%", marginBottom: 8 }}
              />
              <div className="admin-skeleton admin-skeleton-text" style={{ width: "40%" }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TeamSkeleton() {
  return (
    <section aria-label="Loading team members" role="status">
      <AdminSectionHeadSkeleton titleWidth={160} descWidth={380} />
      <div className="admin-two-column">
        <div className="admin-panel" style={{ padding: 24 }}>
          <div
            className="admin-skeleton admin-skeleton-title"
            style={{ width: 160, marginBottom: 20 }}
          />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: "16px 0",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ width: "60%" }}>
                <div
                  className="admin-skeleton admin-skeleton-text"
                  style={{ width: "50%", marginBottom: 6 }}
                />
                <div className="admin-skeleton admin-skeleton-text" style={{ width: "80%" }} />
              </div>
              <div className="admin-skeleton" style={{ width: 60, height: 28, borderRadius: 6 }} />
            </div>
          ))}
        </div>
        <div className="admin-panel admin-form" style={{ padding: 24 }}>
          <div
            className="admin-skeleton admin-skeleton-title"
            style={{ width: 180, marginBottom: 20 }}
          />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div
                className="admin-skeleton admin-skeleton-text"
                style={{ width: "35%", marginBottom: 8 }}
              />
              <div
                className="admin-skeleton"
                style={{ width: "100%", height: 38, borderRadius: 6 }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SettingsSkeleton() {
  return (
    <section aria-label="Loading settings" role="status">
      <AdminSectionHeadSkeleton titleWidth={140} descWidth={440} />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="admin-panel" style={{ padding: 24 }}>
            <div
              className="admin-skeleton admin-skeleton-title"
              style={{ width: 220, marginBottom: 16 }}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
              }}
            >
              {Array.from({ length: 3 }).map((__, j) => (
                <div key={j}>
                  <div
                    className="admin-skeleton admin-skeleton-text"
                    style={{ width: "40%", marginBottom: 8 }}
                  />
                  <div
                    className="admin-skeleton"
                    style={{ width: "100%", height: 38, borderRadius: 6 }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminWorkspaceSkeleton() {
  return (
    <main
      id="main-content"
      className="admin-page"
      role="status"
      aria-label="Loading admin workspace"
    >
      <aside className="admin-sidebar" style={{ pointerEvents: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px" }}>
          <div className="admin-skeleton" style={{ width: 34, height: 34, borderRadius: 8 }} />
          <div className="admin-skeleton" style={{ width: 120, height: 20, borderRadius: 4 }} />
        </div>
        <div style={{ padding: "0 20px", marginTop: 16 }}>
          <div className="admin-skeleton" style={{ width: "100%", height: 48, borderRadius: 8 }} />
        </div>
        <div style={{ padding: "24px 20px 0" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="admin-skeleton"
              style={{ width: "100%", height: 36, borderRadius: 6, marginBottom: 10 }}
            />
          ))}
        </div>
      </aside>
      <div className="admin-content">
        <header className="admin-top">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="admin-skeleton" style={{ width: 60, height: 16, borderRadius: 4 }} />
            <div className="admin-skeleton" style={{ width: 12, height: 16, borderRadius: 4 }} />
            <div className="admin-skeleton" style={{ width: 100, height: 16, borderRadius: 4 }} />
          </div>
        </header>
        <div className="admin-main">
          <CoursesSkeleton />
        </div>
      </div>
    </main>
  );
}
