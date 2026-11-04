"use client";

import Link from "next/link";
import { ShieldCheck, Question } from "@phosphor-icons/react";
import type { PurchaseUser } from "../../../shared/purchase";

export interface StudentProfilePanelProps {
  user: PurchaseUser;
  local?: boolean;
  loggingOut: boolean;
  onLogout: () => void;
}

export function StudentProfilePanel({
  user,
  local = false,
  loggingOut,
  onLogout,
}: StudentProfilePanelProps) {
  return (
    <div>
      <div className="student-greeting-head">
        <div>
          <h1>Profile & settings</h1>
          <p>Manage your student credentials, security sessions, and account details.</p>
        </div>
      </div>

      <div className="student-profile-grid">
        <div className="student-profile-card">
          <div className="student-profile-avatar-big">
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: "18px" }}>{user.name}</h3>
            <span className="student-role-pill">
              <i />
              Verified student
            </span>
          </div>

          <div className="student-info-row">
            <span className="student-info-label">Email address</span>
            <span className="student-info-val">{user.email}</span>
          </div>

          <div className="student-info-row">
            <span className="student-info-label">Account type</span>
            <span className="student-info-val">Learner portal</span>
          </div>

          <div className="student-info-row">
            <span className="student-info-label">User ID</span>
            <span
              className="student-info-val"
              style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)" }}
            >
              {user.id}
            </span>
          </div>

          <button
            type="button"
            className="button button-danger button-sm"
            disabled={loggingOut}
            onClick={onLogout}
            style={{ marginTop: "12px" }}
          >
            {loggingOut ? "Signing out…" : "Sign out from this device"}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="student-profile-card">
            <h3 style={{ margin: "0 0 8px", fontSize: "16px" }}>Security & Single Session</h3>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "13px",
                color: "var(--muted)",
                lineHeight: 1.5,
              }}
            >
              To protect course materials and comply with our terms, your account is tied to
              verified single-device playback. If you switch devices, your previous session is
              cleanly released.
            </p>
            {local ? (
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <ShieldCheck size={16} /> Device management active in production deployment
              </span>
            ) : (
              <Link
                href="/account"
                className="button button-secondary button-sm"
                style={{ alignSelf: "flex-start" }}
              >
                <ShieldCheck size={16} />
                <span>Manage registered devices</span>
              </Link>
            )}
          </div>

          <div className="student-profile-card">
            <h3 style={{ margin: "0 0 8px", fontSize: "16px" }}>Refund Support & Assistance</h3>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "13px",
                color: "var(--muted)",
                lineHeight: 1.5,
              }}
            >
              Need help with an order, or have questions about course access? Our support team is
              available to assist you.
            </p>
            <Link
              href="/contact?topic=refund"
              className="button button-secondary button-sm"
              style={{ alignSelf: "flex-start" }}
            >
              <Question size={16} />
              <span>Contact support desk</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
