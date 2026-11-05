"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UserCircle, Devices, SignOut, ArrowUpRight, Eye, EyeSlash } from "@phosphor-icons/react";
import type { PurchaseUser } from "../../../shared/purchase";

export interface StudentProfilePanelProps {
  user: PurchaseUser;
  local?: boolean;
  loggingOut: boolean;
  onLogout: () => void;
  onSelectCoursesView?: () => void;
}

type RegisteredDevice = {
  id: string;
  name: string;
  lastActive: string;
  current: boolean;
};

async function api(path: string, method = "GET", payload?: unknown) {
  const response = await fetch(path, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Please try again.") as Error & {
      code?: string;
      status?: number;
    };
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

export function StudentProfilePanel({
  user,
  local = false,
  loggingOut,
  onLogout,
  onSelectCoursesView,
}: StudentProfilePanelProps) {
  const [currentUser, setCurrentUser] = useState<PurchaseUser>(user);
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);

  // Profile Form State
  const [pendingProfile, setPendingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");

  // Password Form State
  const [pendingPassword, setPendingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

  // Device Management State
  const [pendingDevice, setPendingDevice] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const [deviceMessage, setDeviceMessage] = useState("");

  // Fetch full user details and registered devices on mount
  useEffect(() => {
    let active = true;

    api("/api/auth/me")
      .then((data) => {
        if (!active || !data?.user) return;
        setCurrentUser({
          id: data.user.id,
          name: data.user.name || user.name,
          email: data.user.email || user.email,
          phone: data.user.phone ?? user.phone ?? null,
          role: data.user.role || user.role,
        });
      })
      .catch(() => {});

    api("/api/auth/devices")
      .then((data) => {
        if (!active) return;
        setDevices(data.devices || []);
      })
      .catch((err) => {
        if (!active) return;
        if (local) {
          setDevices([
            {
              id: "current-dev",
              name: "Current Device / Browser",
              lastActive: new Date().toISOString(),
              current: true,
            },
          ]);
        } else {
          setDeviceError(
            err instanceof Error ? err.message : "Could not load registered devices.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [user, local]);

  // Handle Save Profile
  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingProfile(true);
    setProfileError("");
    setProfileMessage("");
    const form = new FormData(event.currentTarget);
    const newName = String(form.get("name") || "").trim();
    const newPhone = String(form.get("phone") || "").trim();

    try {
      const result = await api("/api/auth/profile", "PATCH", {
        name: newName,
        phone: newPhone,
      });
      setProfileMessage(result.message || "Profile details saved successfully.");
      setCurrentUser((prev) => ({
        ...prev,
        name: newName,
        phone: newPhone,
      }));
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Profile update failed.");
    } finally {
      setPendingProfile(false);
    }
  }

  // Handle Update Password
  async function handleUpdatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingPassword(true);
    setPasswordError("");
    setPasswordMessage("");
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("current") || "");
    const newPassword = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");

    if (newPassword !== confirmation) {
      setPasswordError("The new passwords do not match.");
      setPendingPassword(false);
      return;
    }

    try {
      const result = await api("/api/auth/password", "POST", {
        currentPassword,
        password: newPassword,
      });
      setPasswordMessage(result.message || "Password updated successfully. Please sign in again.");
      (event.target as HTMLFormElement).reset();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Password update failed.");
    } finally {
      setPendingPassword(false);
    }
  }

  // Handle Revoke Single Device
  async function handleRevokeDevice(deviceId: string) {
    setPendingDevice(true);
    setDeviceError("");
    setDeviceMessage("");
    try {
      await api("/api/auth/devices", "DELETE", { deviceId });
      const current = devices.find((d) => d.id === deviceId);
      if (current?.current) {
        window.location.replace("/login");
        return;
      }
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      setDeviceMessage("Device signed out successfully.");
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : "Device could not be signed out.");
    } finally {
      setPendingDevice(false);
    }
  }

  // Handle Sign Out All Devices
  async function handleLogoutAllDevices() {
    setPendingDevice(true);
    setDeviceError("");
    try {
      const result = await api("/api/auth/logout-all", "POST", {});
      window.location.assign(result.redirect || "/login");
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : "Could not sign out all devices.");
      setPendingDevice(false);
    }
  }

  return (
    <div>
      {/* Top Learning Space Heading */}
      <div className="account-heading" style={{ marginBottom: "28px" }}>
        <div>
          <span className="auth-section-label">Your account</span>
          <h1 style={{ margin: "4px 0 8px" }}>Your learning space</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "14px" }}>
            Signed in as {currentUser.email}
          </p>
        </div>
        <button
          type="button"
          className="button button-secondary"
          disabled={loggingOut}
          onClick={onLogout}
          style={{ alignSelf: "flex-start" }}
        >
          <SignOut size={17} />
          <span>{loggingOut ? "Signing out…" : "Sign out"}</span>
        </button>
      </div>

      {/* Main 2-Column Account Grid */}
      <div className="account-grid">
        {/* LEFT COLUMN: Profile Details + Change Password */}
        <div>
          {/* Profile Details Panel */}
          <section className="account-panel">
            <div className="account-panel-heading">
              <UserCircle size={23} />
              <h2>Profile details</h2>
            </div>

            {profileError && (
              <p className="auth-error" role="alert" style={{ marginBottom: "16px" }}>
                {profileError}
              </p>
            )}
            {profileMessage && (
              <p className="auth-message" role="status" style={{ marginBottom: "16px" }}>
                {profileMessage}
              </p>
            )}

            <form className="auth-form" onSubmit={handleSaveProfile}>
              <label htmlFor="profile-name">
                Full name
                <input
                  id="profile-name"
                  name="name"
                  required
                  maxLength={80}
                  defaultValue={currentUser.name}
                  key={`name-${currentUser.name}`}
                />
              </label>

              <label htmlFor="profile-email">
                Verified email
                <input id="profile-email" type="email" readOnly value={currentUser.email} />
              </label>

              <label htmlFor="profile-phone">
                Phone <span className="field-optional">(optional)</span>
                <input
                  id="profile-phone"
                  name="phone"
                  type="tel"
                  maxLength={25}
                  defaultValue={currentUser.phone ?? ""}
                  key={`phone-${currentUser.phone ?? ""}`}
                />
              </label>

              <button className="button button-primary" disabled={pendingProfile} type="submit">
                {pendingProfile ? "Saving…" : "Save profile"}
              </button>
            </form>
          </section>

          {/* Change Password Panel */}
          <section className="account-panel">
            <h2>Change password</h2>
            <p>After changing your password, sign in again on your devices.</p>

            {passwordError && (
              <p className="auth-error" role="alert" style={{ marginBottom: "16px" }}>
                {passwordError}
              </p>
            )}
            {passwordMessage && (
              <p className="auth-message" role="status" style={{ marginBottom: "16px" }}>
                {passwordMessage}
              </p>
            )}

            <form className="auth-form" onSubmit={handleUpdatePassword}>
              <label htmlFor="current-password">
                Current password
                <div className="auth-password-wrapper">
                  <input
                    id="current-password"
                    name="current"
                    type={showCurrentPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                    title={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? <EyeSlash size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </label>

              <label htmlFor="new-password">
                New password
                <div className="auth-password-wrapper">
                  <input
                    id="new-password"
                    name="password"
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                    title={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeSlash size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </label>

              <label htmlFor="repeat-password">
                Confirm new password
                <div className="auth-password-wrapper">
                  <input
                    id="repeat-password"
                    name="confirmation"
                    type={showRepeatPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowRepeatPassword((prev) => !prev)}
                    aria-label={showRepeatPassword ? "Hide password" : "Show password"}
                    title={showRepeatPassword ? "Hide password" : "Show password"}
                  >
                    {showRepeatPassword ? <EyeSlash size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </label>

              <p className="auth-field-help">
                Use at least 12 characters, including uppercase, lowercase and a number.
              </p>

              <button className="button button-secondary" disabled={pendingPassword} type="submit">
                {pendingPassword ? "Updating…" : "Update password"}
              </button>
            </form>
          </section>
        </div>

        {/* RIGHT COLUMN: Active Devices + Next Learning Step + Support */}
        <div>
          {/* Active Devices Panel */}
          <section className="account-panel">
            <div className="account-panel-heading">
              <Devices size={23} />
              <h2>Active devices</h2>
            </div>

            <p>
              Up to two devices can be active. Signing out a device stops its account access
              immediately.
            </p>

            {deviceError && (
              <p className="auth-error" role="alert" style={{ marginBottom: "16px" }}>
                {deviceError}
              </p>
            )}
            {deviceMessage && (
              <p className="auth-message" role="status" style={{ marginBottom: "16px" }}>
                {deviceMessage}
              </p>
            )}

            <div className="device-list">
              {devices.map((device) => {
                const formattedDate = new Date(device.lastActive).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                });

                return (
                  <div className="device-row" key={device.id}>
                    <div>
                      <strong>
                        {device.name}
                        {device.current && <span className="device-current">This device</span>}
                      </strong>
                      <small>{formattedDate} IST</small>
                    </div>

                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={pendingDevice}
                      onClick={() => handleRevokeDevice(device.id)}
                    >
                      Sign out
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="button button-secondary"
              disabled={pendingDevice}
              onClick={handleLogoutAllDevices}
              style={{ marginTop: "8px" }}
            >
              Sign out all devices
            </button>
          </section>

          {/* Your Next Learning Step Panel */}
          <section className="account-panel">
            <h2>Your next learning step</h2>
            <p>
              Open your enrolled courses, continue a lesson or review your learning progress. New
              purchases remain unavailable in this preview.
            </p>
            {onSelectCoursesView ? (
              <button
                type="button"
                className="button button-primary"
                onClick={onSelectCoursesView}
              >
                <span>My learning</span>
                <ArrowUpRight size={17} />
              </button>
            ) : (
              <Link href="/dashboard" className="button button-primary">
                <span>My learning</span>
                <ArrowUpRight size={17} />
              </Link>
            )}
          </section>

          {/* Refund Support Panel */}
          <section className="account-panel">
            <h2>Refund Support & Assistance</h2>
            <p>
              Need help with an order, or have questions about course access? Our support team is
              available to assist you.
            </p>
            <Link
              href="/contact?topic=refund"
              className="button button-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              <span>Contact support desk</span>
              <ArrowUpRight size={17} />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
