"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  User as UserIcon,
  Camera,
  Trash,
  Check,
  Lock,
  Eye,
  EyeSlash,
  ShieldCheck,
  FloppyDisk,
  Phone,
  Envelope,
} from "@phosphor-icons/react";

interface AdminProfilePanelProps {
  user: {
    id?: string;
    email: string;
    name?: string;
    phone?: string | null;
    role: "admin" | "support" | "student";
    aal?: string;
  };
  onProfileUpdated?: (updated: { name: string; phone?: string | null }) => void;
}

export function AdminProfilePanel({ user, onProfileUpdated }: AdminProfilePanelProps) {
  const [name, setName] = useState(user.name || "Administrator");
  const [phone, setPhone] = useState(user.phone || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("globalbulls_admin_avatar");
    }
    return null;
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen to avatar updates from other tabs/components
  useEffect(() => {
    const onAvatarUpdate = () => {
      setAvatarUrl(localStorage.getItem("globalbulls_admin_avatar"));
    };
    window.addEventListener("globalbulls_avatar_updated", onAvatarUpdate);
    return () => window.removeEventListener("globalbulls_avatar_updated", onAvatarUpdate);
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (PNG, JPG, WebP).");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      toast.error("Image size must be under 3MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAvatarUrl(result);
        if (typeof window !== "undefined") {
          localStorage.setItem("globalbulls_admin_avatar", result);
          window.dispatchEvent(new Event("globalbulls_avatar_updated"));
        }
        toast.success("Profile picture updated!");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("globalbulls_admin_avatar");
      window.dispatchEvent(new Event("globalbulls_avatar_updated"));
    }
    toast.success("Custom profile photo removed.");
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Profile update failed.");

      toast.success(data.message || "Profile updated successfully!");
      if (onProfileUpdated) {
        onProfileUpdated({ name: name.trim(), phone: phone.trim() || null });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Profile update failed.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      toast.error("Please enter a new password.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPassword || undefined,
          password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Password update failed.");

      toast.success(data.message || "Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Password update failed.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="admin-profile-view">
      <div className="admin-section-head">
        <div>
          <h2>Profile & account settings</h2>
          <p>Manage your administrator credentials, profile picture, name, and password.</p>
        </div>
      </div>

      <div className="admin-two-column">
        {/* Left Column: Profile Picture & Basic Info */}
        <div style={{ display: "grid", gap: "22px" }}>
          {/* Avatar / PFP Card */}
          <article className="admin-panel">
            <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "17px" }}>
              <UserIcon size={20} color="var(--accent)" /> Profile Picture (PFP)
            </h3>
            <p style={{ margin: "0 0 20px" }}>
              Upload your photo to personalize your administrator avatar across the dashboard.
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "22px" }}>
              <div
                style={{
                  position: "relative",
                  width: "88px",
                  height: "88px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "2px solid var(--accent)",
                  boxShadow: "0 0 16px rgba(0, 223, 143, 0.22)",
                  background: "var(--raised)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={avatarUrl}
                    alt="Admin Avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: "32px",
                      fontWeight: 700,
                      color: "var(--accent)",
                      fontFamily: "var(--display)",
                    }}
                  >
                    {(name?.trim().charAt(0) || user.email.slice(0, 1)).toUpperCase()}
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gap: "10px" }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  accept="image/png, image/jpeg, image/webp"
                  style={{ display: "none" }}
                  aria-label="Upload profile photo"
                />
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ gap: "8px" }}
                >
                  <Camera size={16} />
                  <span>Upload new photo</span>
                </button>

                {avatarUrl && (
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={handleRemoveAvatar}
                    style={{ gap: "8px" }}
                  >
                    <Trash size={16} />
                    <span>Remove photo</span>
                  </button>
                )}
                <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                  PNG, JPG or WebP up to 3MB
                </small>
              </div>
            </div>
          </article>

          {/* Personal Info Form */}
          <article className="admin-panel">
            <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "17px" }}>
              <ShieldCheck size={20} color="var(--accent)" /> Administrator Details
            </h3>
            <p style={{ margin: "0 0 20px" }}>
              Your full name and contact information displayed in workspace logs.
            </p>

            <form onSubmit={handleSaveProfile} style={{ display: "grid", gap: "16px" }}>
              <div>
                <label className="admin-field-label" htmlFor="admin-name">
                  Full Name
                </label>
                <input
                  id="admin-name"
                  type="text"
                  className="admin-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Master Trader"
                  required
                  maxLength={80}
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
                />
              </div>

              <div>
                <label className="admin-field-label" htmlFor="admin-email">
                  Email Address
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="admin-email"
                    type="email"
                    value={user.email}
                    disabled
                    style={{
                      width: "100%",
                      minHeight: "42px",
                      padding: "10px 14px",
                      paddingLeft: "36px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: "rgba(255, 255, 255, 0.03)",
                      color: "var(--muted)",
                      fontSize: "13px",
                      cursor: "not-allowed",
                    }}
                  />
                  <Envelope
                    size={16}
                    color="var(--muted)"
                    style={{ position: "absolute", left: "12px", top: "13px" }}
                  />
                </div>
                <small style={{ color: "var(--muted)", fontSize: "11px", marginTop: "4px", display: "block" }}>
                  System verified primary administrator email
                </small>
              </div>

              <div>
                <label className="admin-field-label" htmlFor="admin-phone">
                  Phone Number
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="admin-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
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
                  <Phone
                    size={16}
                    color="var(--muted)"
                    style={{ position: "absolute", left: "12px", top: "13px" }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="button button-primary"
                disabled={savingProfile}
                style={{ justifySelf: "start", marginTop: "8px", gap: "8px" }}
              >
                {savingProfile ? (
                  <span>Saving…</span>
                ) : (
                  <>
                    <FloppyDisk size={16} />
                    <span>Save profile changes</span>
                  </>
                )}
              </button>
            </form>
          </article>
        </div>

        {/* Right Column: Password Change & Security */}
        <div style={{ display: "grid", gap: "22px" }}>
          {/* Change Password Card */}
          <article className="admin-panel">
            <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "17px" }}>
              <Lock size={20} color="var(--accent)" /> Change Password
            </h3>
            <p style={{ margin: "0 0 20px" }}>
              Ensure your administrator credentials use a strong, unique passphrase.
            </p>

            <form onSubmit={handleUpdatePassword} style={{ display: "grid", gap: "16px" }}>
              <div>
                <label className="admin-field-label" htmlFor="current-pw">
                  Current Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="current-pw"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    style={{
                      width: "100%",
                      minHeight: "42px",
                      padding: "10px 40px 10px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "13px",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((p) => !p)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "12px",
                      background: "none",
                      border: "none",
                      color: "var(--muted)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    aria-label={showCurrent ? "Hide password" : "Show password"}
                  >
                    {showCurrent ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="admin-field-label" htmlFor="new-pw">
                  New Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="new-pw"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    style={{
                      width: "100%",
                      minHeight: "42px",
                      padding: "10px 40px 10px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "13px",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((p) => !p)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "12px",
                      background: "none",
                      border: "none",
                      color: "var(--muted)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    aria-label={showNew ? "Hide password" : "Show password"}
                  >
                    {showNew ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="admin-field-label" htmlFor="confirm-pw">
                  Confirm New Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="confirm-pw"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    required
                    style={{
                      width: "100%",
                      minHeight: "42px",
                      padding: "10px 40px 10px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "13px",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((p) => !p)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "12px",
                      background: "none",
                      border: "none",
                      color: "var(--muted)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="button button-primary"
                disabled={updatingPassword}
                style={{ justifySelf: "start", marginTop: "8px", gap: "8px" }}
              >
                {updatingPassword ? (
                  <span>Updating…</span>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Update password</span>
                  </>
                )}
              </button>
            </form>
          </article>

          {/* Account Security Overview Card */}
          <article className="admin-panel">
            <h3 style={{ fontSize: "17px" }}>Security & Access Level</h3>
            <div className="admin-stack" style={{ marginTop: "16px" }}>
              <div>
                <span>Role authority</span>
                <span className="student-role-pill" style={{ textTransform: "capitalize" }}>
                  <i /> Administrator
                </span>
              </div>
              <div>
                <span>Authentication assurance</span>
                <strong style={{ fontSize: "12px", color: "var(--accent)" }}>
                  {user.aal === "local-demo" ? "Local sandbox (AAL2 ready)" : user.aal || "Verified AAL2"}
                </strong>
              </div>
              <div>
                <span>Device policy</span>
                <strong style={{ fontSize: "12px", color: "var(--accent)" }}>Unlimited devices (Admin unrestricted)</strong>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
