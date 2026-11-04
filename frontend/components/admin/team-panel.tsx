"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  ShieldPlus,
  Trash,
  Envelope,
  User,
  Key,
  ShieldCheck,
  CheckCircle,
} from "@phosphor-icons/react";

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "support";
}

interface TeamPanelProps {
  currentUserId?: string;
}

export function TeamPanel({ currentUserId }: TeamPanelProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "support">("admin");

  const loadStaff = async () => {
    try {
      const res = await fetch("/api/admin/staff");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load staff.");
      setStaff(data.staff || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/admin/staff")
      .then((res) => res.json())
      .then((data) => {
        if (active) setStaff(data.staff || []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load team members.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      toast.error("Please enter both name and email.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add member.");

      toast.success(data.message || "Team member added successfully!");
      setName("");
      setEmail("");
      loadStaff();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add team member.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string, memberEmail: string) => {
    if (!confirm(`Are you sure you want to remove administrator/staff access for ${memberEmail}?`)) {
      return;
    }

    try {
      const res = await fetch("/api/admin/staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove staff.");

      toast.success(data.message || "Access removed.");
      loadStaff();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove member.");
    }
  };

  return (
    <section>
      <div className="admin-section-head">
        <div>
          <h2>Administrators & Team</h2>
          <p>
            Manage workspace administrators and support staff. Only verified administrators can access
            this console.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}

      <div className="admin-two-column">
        {/* Left Column: Staff List */}
        <div style={{ display: "grid", gap: "20px" }}>
          <article className="admin-panel">
            <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "17px" }}>
              <Users size={20} color="var(--accent)" /> Active Team Members ({staff.length})
            </h3>
            <p style={{ margin: "0 0 16px" }}>
              Accounts with administrative or customer-support authorization.
            </p>

            {loading ? (
              <p style={{ color: "var(--muted)" }}>Loading team members…</p>
            ) : staff.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>No staff accounts found.</p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {staff.map((member) => {
                  const isCurrent = member.id === currentUserId;
                  return (
                    <div
                      key={member.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 16px",
                        background: "var(--background)",
                        border: "1px solid var(--line)",
                        borderRadius: "10px",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            background:
                              member.role === "admin"
                                ? "rgba(0, 223, 143, 0.15)"
                                : "rgba(59, 130, 246, 0.15)",
                            color: member.role === "admin" ? "var(--accent)" : "#60a5fa",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "16px",
                            flexShrink: 0,
                          }}
                        >
                          {(member.full_name?.charAt(0) || member.email.charAt(0)).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <strong style={{ fontSize: "14px", color: "var(--foreground)" }}>
                              {member.full_name || "Staff Member"}
                            </strong>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                background:
                                  member.role === "admin"
                                    ? "rgba(0, 223, 143, 0.16)"
                                    : "rgba(59, 130, 246, 0.16)",
                                color: member.role === "admin" ? "var(--accent)" : "#93c5fd",
                              }}
                            >
                              {member.role === "admin" ? "Admin" : "Support"}
                            </span>
                            {isCurrent && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--muted)",
                                  border: "1px solid var(--line)",
                                  padding: "1px 6px",
                                  borderRadius: "6px",
                                }}
                              >
                                You
                              </span>
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: "12px",
                              color: "var(--muted)",
                              display: "block",
                              marginTop: "2px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {member.email}
                          </span>
                        </div>
                      </div>

                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id, member.email)}
                          className="button button-danger"
                          style={{ padding: "6px 10px", fontSize: "12px", flexShrink: 0 }}
                          title="Revoke admin access"
                        >
                          <Trash size={14} />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          {/* Security Gate Info */}
          <article className="admin-panel">
            <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "17px" }}>
              <Key size={20} color="var(--accent)" /> Admin Secret Key Protection
            </h3>
            <p style={{ margin: "0 0 12px", lineHeight: "1.55" }}>
              The Admin Portal (<code style={{ color: "var(--accent)" }}>/admin/login</code>) is secured
              with an <strong>Admin Secret Key</strong> gate.
            </p>
            <ul style={{ margin: 0, paddingLeft: "18px", color: "var(--muted)", fontSize: "13px", lineHeight: "1.6" }}>
              <li>Admins cannot sign in from the public student login page.</li>
              <li>Only visits to <code>/admin/login</code> with the Secret Key can open the login terminal.</li>
              <li>Configure <code>ADMIN_SECRET_KEY</code> in Vercel and <code>.env.local</code>.</li>
            </ul>
          </article>
        </div>

        {/* Right Column: Add Admin Form */}
        <div style={{ display: "grid", gap: "20px" }}>
          <article className="admin-panel">
            <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "17px" }}>
              <ShieldPlus size={20} color="var(--accent)" /> Add Administrator or Staff
            </h3>
            <p style={{ margin: "0 0 18px" }}>
              Invite a new team member or promote an existing registered account to Administrator or Support.
            </p>

            <form onSubmit={handleAddMember} style={{ display: "grid", gap: "16px" }}>
              <div>
                <label className="admin-field-label" htmlFor="staff-name">
                  Full Name
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="staff-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    maxLength={80}
                    style={{
                      width: "100%",
                      minHeight: "42px",
                      padding: "10px 14px",
                      paddingLeft: "36px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "13px",
                    }}
                  />
                  <User
                    size={16}
                    color="var(--muted)"
                    style={{ position: "absolute", left: "12px", top: "13px" }}
                  />
                </div>
              </div>

              <div>
                <label className="admin-field-label" htmlFor="staff-email">
                  Email Address
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="staff-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teammate@example.com"
                    style={{
                      width: "100%",
                      minHeight: "42px",
                      padding: "10px 14px",
                      paddingLeft: "36px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "13px",
                    }}
                  />
                  <Envelope
                    size={16}
                    color="var(--muted)"
                    style={{ position: "absolute", left: "12px", top: "13px" }}
                  />
                </div>
              </div>

              <div>
                <label className="admin-field-label" htmlFor="staff-role">
                  Access Level / Role
                </label>
                <select
                  id="staff-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "admin" | "support")}
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    background: "var(--background)",
                    color: "var(--foreground)",
                    fontSize: "13px",
                  }}
                >
                  <option value="admin">Administrator (Full Access: Courses, Orders, Team)</option>
                  <option value="support">Support Staff (Overview, Orders, Refunds, Students)</option>
                </select>
              </div>

              <div
                style={{
                  background: "rgba(0, 223, 143, 0.06)",
                  border: "1px solid rgba(0, 223, 143, 0.2)",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  fontSize: "12px",
                  color: "var(--muted)",
                  lineHeight: "1.5",
                }}
              >
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <CheckCircle size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span>
                    If this email already has a student account, it will be immediately promoted. If it is new, an invitation email with a secure setup link will be dispatched.
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="button button-primary"
                disabled={submitting}
                style={{ justifySelf: "start", gap: "8px", marginTop: "4px" }}
              >
                <ShieldCheck size={16} />
                <span>{submitting ? "Adding…" : `Add ${role === "admin" ? "Administrator" : "Support Staff"}`}</span>
              </button>
            </form>
          </article>
        </div>
      </div>
    </section>
  );
}

