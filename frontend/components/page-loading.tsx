"use client";

import {
  Books,
  Compass,
  Receipt,
  UserCircle,
  GraduationCap,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { BullMark } from "./bull-mark";
import { ThemeToggle } from "./theme-toggle";
import "@/frontend/styles/admin.css";
import "@/frontend/styles/student-dashboard.css";

export default function Loading() {
  return (
    <main
      id="main-content"
      className="admin-page student-dashboard-page student-skeleton-page"
      aria-busy="true"
      aria-label="Loading workspace"
    >
      {/* =========================================================================
          LEFT SIDEBAR SKELETON
          ========================================================================= */}
      <aside className="admin-sidebar" aria-hidden="true">
        <div className="admin-brand">
          <BullMark className="admin-brand-mark" height={54} />
        </div>

        {/* Workspace pill */}
        <div className="student-workspace-switcher" role="status">
          <div className="student-workspace-info">
            <GraduationCap size={17} weight="duotone" color="var(--accent, #00df8f)" />
            <span>Student workspace</span>
          </div>
          <span className="student-workspace-status">
            <i />
            Active
          </span>
        </div>

        {/* Navigation Group: STUDY */}
        <div className="admin-nav-group">
          <span className="admin-nav-label">Study</span>
          <button type="button" disabled>
            <Books size={18} />
            <span>My courses</span>
          </button>
        </div>

        {/* Navigation Group: DISCOVER */}
        <div className="admin-nav-group">
          <span className="admin-nav-label">Discover</span>
          <button type="button" className="is-active" disabled>
            <Compass size={18} weight="fill" />
            <span>Explore courses</span>
          </button>
        </div>

        {/* Navigation Group: ACCOUNT */}
        <div className="admin-nav-group">
          <span className="admin-nav-label">Account</span>
          <button type="button" disabled>
            <Receipt size={18} />
            <span>Billing & receipts</span>
          </button>
          <button type="button" disabled>
            <UserCircle size={18} />
            <span>Profile & settings</span>
          </button>
        </div>

        {/* Bottom user profile skeleton */}
        <div className="admin-sidebar-bottom">
          <div className="student-skeleton-user">
            <div
              className="skeleton"
              style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }}
            />
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div className="skeleton" style={{ width: 90, height: 12, borderRadius: 3 }} />
              <div className="skeleton" style={{ width: 130, height: 10, borderRadius: 3 }} />
            </div>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          RIGHT CONTENT AREA SKELETON
          ========================================================================= */}
      <div className="admin-content">
        {/* Top Header / Breadcrumbs Bar */}
        <header className="student-top-bar">
          <div className="student-breadcrumb">
            <span className="student-breadcrumb-link">Student</span>
            <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>/</span>
            <span className="student-breadcrumb-current">Explore courses</span>
          </div>

          <div className="student-top-actions">
            <ThemeToggle />
            <span className="student-role-pill">
              <i />
              Learner portal
            </span>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="student-main-content">
          <div className="student-greeting-head">
            <div>
              <h1>Explore courses</h1>
              <p>
                Discover structured trading programs, candlestick analysis, and risk management.
              </p>
            </div>
          </div>

          {/* Search & Level Filter Bar */}
          <div className="student-search-bar-row">
            <div className="student-search-input-wrap">
              <MagnifyingGlass size={18} className="student-search-icon" />
              <input
                type="text"
                placeholder="Search courses by topic, title or keywords…"
                disabled
              />
            </div>
            <select disabled>
              <option>All levels</option>
            </select>
          </div>

          {/* Course Cards Grid */}
          <div className="student-course-grid">
            {[0, 1, 2].map((i) => (
              <article key={i} className="student-explore-card">
                <div className="student-skeleton-thumb" />
                <div className="student-explore-card-body">
                  <div
                    className="skeleton"
                    style={{ width: 70, height: 18, borderRadius: 4, marginBottom: 8 }}
                  />
                  <div
                    className="skeleton"
                    style={{ width: "85%", height: 22, borderRadius: 4, marginBottom: 8 }}
                  />
                  <div
                    className="skeleton"
                    style={{ width: "95%", height: 14, borderRadius: 4, marginBottom: 4 }}
                  />
                  <div
                    className="skeleton"
                    style={{ width: "65%", height: 14, borderRadius: 4, marginBottom: 16 }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      marginBottom: 20,
                    }}
                  >
                    <div
                      className="skeleton"
                      style={{ width: "50%", height: 12, borderRadius: 3 }}
                    />
                    <div
                      className="skeleton"
                      style={{ width: "45%", height: 12, borderRadius: 3 }}
                    />
                    <div
                      className="skeleton"
                      style={{ width: "58%", height: 12, borderRadius: 3 }}
                    />
                  </div>
                  <div
                    className="skeleton"
                    style={{
                      width: "100%",
                      height: 44,
                      borderRadius: 8,
                      marginTop: "auto",
                    }}
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only" role="status">
        Loading student workspace…
      </span>
    </main>
  );
}
