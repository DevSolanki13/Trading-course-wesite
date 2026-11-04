"use client";

import { useState, useEffect } from "react";
import AuthPage from "@/frontend/pages/auth-page";
import { LockKey, ShieldCheck, Eye, EyeSlash, ArrowLeft, Key } from "@phosphor-icons/react";
import Link from "next/link";

export function AdminLoginGate() {
  const [unlocked, setUnlocked] = useState(false);
  const [secretKey, setSecretKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingInitial, setCheckingInitial] = useState(() => {
    if (typeof window === "undefined") return true;
    return !!sessionStorage.getItem("admin_secret_key");
  });

  useEffect(() => {
    // Check if key is already in sessionStorage
    const stored = sessionStorage.getItem("admin_secret_key");
    if (!stored) return;

    // Fast verify with backend
    fetch("/api/auth/verify-admin-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secretKey: stored }),
    })
      .then((res) => {
        if (res.ok) {
          setSecretKey(stored);
          setUnlocked(true);
        } else {
          sessionStorage.removeItem("admin_secret_key");
        }
      })
      .catch(() => {})
      .finally(() => setCheckingInitial(false));
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretKey.trim()) {
      setError("Please enter the Admin Secret Key.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-admin-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey: secretKey.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid Admin Secret Key.");
      }

      sessionStorage.setItem("admin_secret_key", secretKey.trim());
      setUnlocked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Access denied. Invalid secret key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* If not unlocked, show the high-security prompt popup */}
      {!unlocked && !checkingInitial && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.88)",
            backdropFilter: "blur(14px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            animation: "fadeIn 0.25s ease",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              background: "var(--raised, #121814)",
              border: "1px solid rgba(0, 223, 143, 0.3)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 223, 143, 0.15)",
              borderRadius: "16px",
              padding: "36px 32px",
              textAlign: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                background: "rgba(0, 223, 143, 0.12)",
                border: "1px solid rgba(0, 223, 143, 0.35)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent, #00df8f)",
                marginBottom: "20px",
              }}
            >
              <LockKey size={30} weight="duotone" />
            </div>

            <h2
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#f3f5f3",
                margin: "0 0 10px",
                letterSpacing: "-0.02em",
              }}
            >
              Admin Access Gate
            </h2>

            <p
              style={{
                fontSize: "14px",
                color: "var(--muted, #94a397)",
                margin: "0 0 26px",
                lineHeight: "1.55",
              }}
            >
              This URL is restricted to authorized indianXtrade administrators. Enter your security
              key to proceed.
            </p>

            {error && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "#fca5a5",
                  fontSize: "13px",
                  marginBottom: "20px",
                  textAlign: "left",
                }}
                role="alert"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleVerify} style={{ display: "grid", gap: "18px" }}>
              <div style={{ position: "relative", textAlign: "left" }}>
                <label
                  htmlFor="admin-secret-input"
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--muted, #94a397)",
                    marginBottom: "8px",
                  }}
                >
                  Admin Secret Key
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="admin-secret-input"
                    type={showKey ? "text" : "password"}
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="Enter secret key…"
                    autoFocus
                    required
                    style={{
                      width: "100%",
                      padding: "12px 42px 12px 38px",
                      background: "rgba(0, 0, 0, 0.45)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "10px",
                      color: "#fff",
                      fontSize: "14px",
                      fontFamily: "monospace",
                      outline: "none",
                      transition: "border-color 0.2s ease",
                    }}
                  />
                  <Key
                    size={18}
                    color="var(--muted, #94a397)"
                    style={{ position: "absolute", left: "12px", top: "14px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((prev) => !prev)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "13px",
                      background: "none",
                      border: "none",
                      color: "var(--muted, #94a397)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    aria-label={showKey ? "Hide key" : "Show key"}
                  >
                    {showKey ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "13px 18px",
                  background: "var(--accent, #00df8f)",
                  color: "#05130b",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: loading ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 18px rgba(0, 223, 143, 0.3)",
                  transition: "opacity 0.2s ease, transform 0.1s ease",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <ShieldCheck size={18} weight="bold" />
                <span>{loading ? "Verifying key…" : "Unlock Admin Portal"}</span>
              </button>
            </form>

            <div style={{ marginTop: "22px" }}>
              <Link
                href="/"
                style={{
                  color: "var(--muted, #94a397)",
                  fontSize: "13px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  textDecoration: "none",
                }}
              >
                <ArrowLeft size={14} /> Back to storefront
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Admin Login page rendered once unlocked (or blurred behind modal) */}
      <div
        style={{
          filter: unlocked ? "none" : "blur(12px)",
          pointerEvents: unlocked ? "auto" : "none",
        }}
      >
        <AuthPage mode="login" admin next="/admin" secretKey={secretKey} />
      </div>
    </>
  );
}
