"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Key,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Envelope,
  Eye,
  EyeSlash,
  CircleNotch,
} from "@phosphor-icons/react";
import { BullMark } from "@/frontend/components/bull-mark";
import "@/frontend/styles/auth.css";

export function AdminDirectTerminal() {
  const [secretKey, setSecretKey] = useState("");
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretKey.trim()) {
      setError("Please enter the Admin Secret Key.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/auth/admin-direct-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secretKey: secretKey.trim(),
          email: email.trim() || undefined,
          remember,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Admin authentication failed.");
      }

      setSuccessMsg(data.message || "Admin key verified. Entering dashboard…");
      sessionStorage.setItem("admin_secret_key", secretKey.trim());
      window.location.assign(data.redirect || "/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid Admin Secret Key.");
      setLoading(false);
    }
  };

  return (
    <main id="main-content" className="admin-terminal-page">
      <div className="admin-terminal-card">
        {/* Header Block - Centered, Distinct Vertical Rhythm */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            marginBottom: "32px",
          }}
        >
          {/* Eyebrow Pill */}
          <div className="admin-terminal-pill">
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "currentColor",
                boxShadow: "0 0 8px currentColor",
              }}
            />
            Restricted Admin Terminal
          </div>

          {/* Logo Lockup */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              marginBottom: "14px",
            }}
          >
            <BullMark height={46} />
          </div>

          {/* Title in Modern Clean Sans */}
          <h1 className="admin-terminal-title">Administrator Login</h1>

          {/* Subtitle */}
          <p className="admin-terminal-desc">
            Enter your secret key to directly access the control workspace. No Google sign-in
            required.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "10px",
              padding: "12px 14px",
              color: "#ef4444",
              fontSize: "13px",
              marginBottom: "22px",
              textAlign: "left",
              lineHeight: "1.45",
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div
            style={{
              background: "rgba(0, 223, 143, 0.12)",
              border: "1px solid rgba(0, 223, 143, 0.35)",
              borderRadius: "10px",
              padding: "12px 14px",
              color: "var(--accent, #00df8f)",
              fontSize: "13px",
              marginBottom: "22px",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            role="status"
          >
            <CircleNotch size={18} className="spin" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "20px" }}>
          {/* Secret Key Input */}
          <div style={{ textAlign: "left" }}>
            <label htmlFor="admin-key" className="admin-terminal-label">
              Admin Secret Key *
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="admin-key"
                type={showKey ? "text" : "password"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Enter secret key…"
                autoFocus
                required
                className="admin-terminal-input"
                style={{
                  fontFamily: secretKey ? "monospace" : "inherit",
                  letterSpacing: secretKey && !showKey ? "0.15em" : "normal",
                }}
              />
              <Key
                size={18}
                color="var(--accent, #00df8f)"
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                style={{
                  position: "absolute",
                  right: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "inherit",
                  opacity: 0.6,
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Admin Email (Optional) */}
          <div style={{ textAlign: "left" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: "8px",
              }}
            >
              <label
                htmlFor="admin-email"
                className="admin-terminal-label"
                style={{ marginBottom: 0 }}
              >
                Admin Email{" "}
                <span style={{ textTransform: "none", fontWeight: 400, opacity: 0.7 }}>
                  (optional)
                </span>
              </label>
              <span className="admin-terminal-subtext">Defaults to primary admin</span>
            </div>
            <div style={{ position: "relative" }}>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Leave blank to use primary admin"
                className="admin-terminal-input"
              />
              <Envelope
                size={18}
                color="currentColor"
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  opacity: 0.5,
                }}
              />
            </div>
          </div>

          {/* Remember device checkbox */}
          <label className="admin-terminal-checkbox-label">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{
                accentColor: "var(--accent, #00df8f)",
                width: "16px",
                height: "16px",
                cursor: "pointer",
              }}
            />
            <span>Remember session on this device for 30 days</span>
          </label>

          {/* Direct Login Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              minHeight: "48px",
              padding: "13px 20px",
              background: "linear-gradient(135deg, #00df8f 0%, #00b975 100%)",
              color: "#03170c",
              border: "none",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "14px",
              letterSpacing: "-0.01em",
              cursor: loading ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.15), 0 0 20px rgba(0, 223, 143, 0.28)",
              transition: "transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease",
              opacity: loading ? 0.75 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
            }}
          >
            {loading ? (
              <>
                <CircleNotch size={18} className="spin" />
                <span>Authenticating…</span>
              </>
            ) : (
              <>
                <ShieldCheck size={19} weight="bold" />
                <span>Enter Admin Workspace</span>
                <ArrowRight size={16} weight="bold" />
              </>
            )}
          </button>
        </form>

        {/* Back Link */}
        <div style={{ marginTop: "28px", textAlign: "center" }}>
          <Link href="/" className="admin-terminal-back">
            <ArrowLeft size={14} /> Back to storefront
          </Link>
        </div>
      </div>
    </main>
  );
}
