"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MfaPanel } from "./mfa-panel";
import { ArrowUpRight, SignOut, ShieldCheck, Devices, UserCircle } from "@phosphor-icons/react";
type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "student" | "support" | "admin";
  aal: string;
};
type Device = { id: string; name: string; lastActive: string; current: boolean };
type Staff = { id: string; full_name: string; email: string; role: string };

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

function StaffPanel({ currentId }: { currentId: string }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function load() {
    const data = await api("/api/admin/staff");
    setStaff(data.staff);
  }
  useEffect(() => {
    api("/api/admin/staff")
      .then((data) => setStaff(data.staff))
      .catch((reason) => setError(reason.message));
  }, []);
  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const data = await api("/api/admin/staff", "POST", {
        email: form.get("email"),
        name: form.get("name"),
      });
      setMessage(data.message);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Invitation failed.");
    } finally {
      setPending(false);
    }
  }
  async function remove(userId: string) {
    setPending(true);
    setError("");
    try {
      const data = await api("/api/admin/staff", "DELETE", { userId });
      setMessage(data.message);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Access could not be removed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="account-panel">
      <h2>Support team</h2>
      <p>
        Invite a new support account. Support staff cannot change courses, prices, settings or staff
        access.
      </p>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="auth-message" role="status">
          {message}
        </p>
      )}
      <div className="staff-list">
        {staff.map((person) => (
          <div className="staff-row" key={person.id}>
            <div>
              <strong>{person.full_name || person.email}</strong>
              <small>
                {person.email} · {person.role}
              </small>
            </div>
            {person.role === "support" && person.id !== currentId && (
              <button
                className="button button-secondary"
                disabled={pending}
                onClick={() => remove(person.id)}
              >
                Remove staff access
              </button>
            )}
          </div>
        ))}
      </div>
      <form className="auth-form staff-invite" onSubmit={invite}>
        <label htmlFor="staff-name">
          Staff name
          <input id="staff-name" name="name" required maxLength={80} />
        </label>
        <label htmlFor="staff-email">
          Staff email
          <input id="staff-email" name="email" type="email" required />
        </label>
        <button className="button button-primary" disabled={pending}>
          Send support invitation
        </button>
      </form>
    </section>
  );
}

export function AccountWorkspace({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    api("/api/auth/me")
      .then(async (data) => {
        if (!active) return;
        if (admin && !["admin", "support"].includes(data.user.role)) {
          window.location.replace("/account");
          return;
        }
        setUser(data.user);
        if (!admin) {
          const result = await api("/api/auth/devices");
          if (active) setDevices(result.devices);
        }
      })
      .catch((reason) => {
        if (!active) return;
        if (reason.code === "DEVICE_LIMIT") {
          window.location.replace("/auth/devices");
          return;
        }
        if (reason.status === 401) {
          window.location.replace(
            `${admin ? "/admin/login" : "/login"}?next=${admin ? "/admin" : "/account"}`,
          );
          return;
        }
        setError(reason.message);
      });
    return () => {
      active = false;
    };
  }, [admin]);
  async function logout(all = false) {
    setPending(true);
    setError("");
    try {
      const result = await api(`/api/auth/${all ? "logout-all" : "logout"}`, "POST", {});
      window.location.assign(result.redirect);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Please try again.");
      setPending(false);
    }
  }
  async function profile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api("/api/auth/profile", "PATCH", {
        name: form.get("name"),
        phone: form.get("phone"),
      });
      setMessage(result.message);
      setUser((current) =>
        current
          ? { ...current, name: String(form.get("name")), phone: String(form.get("phone")) }
          : current,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Profile update failed.");
    } finally {
      setPending(false);
    }
  }
  async function password(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      if (form.get("password") !== form.get("confirmation"))
        throw new Error("The new passwords do not match.");
      const result = await api("/api/auth/password", "POST", {
        currentPassword: form.get("current"),
        password: form.get("password"),
      });
      window.location.assign(result.redirect);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Password update failed.");
      setPending(false);
    }
  }
  async function revoke(deviceId: string) {
    setPending(true);
    setError("");
    try {
      await api("/api/auth/devices", "DELETE", { deviceId });
      const current = devices.find((device) => device.id === deviceId);
      if (current?.current) {
        router.replace("/login");
        router.refresh();
        return;
      }
      setDevices((list) => list.filter((device) => device.id !== deviceId));
      setMessage("Device signed out.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Device could not be signed out.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main id="main-content" className="container account-page">
      <header className="account-heading">
        <div>
          <span className="auth-section-label">{admin ? "Team workspace" : "Your account"}</span>
          <h1>{admin ? "Staff access & security" : "Your learning space"}</h1>
          <p>{user ? `Signed in as ${user.email}` : "Checking your secure session…"}</p>
        </div>
        <button className="button button-secondary" disabled={pending} onClick={() => logout()}>
          <SignOut size={17} />
          Sign out
        </button>
      </header>
      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="auth-message" role="status">
          {message}
        </div>
      )}
      {!user ? (
        <div className="account-loading" role="status">
          {error ? (
            <button className="button button-secondary" onClick={() => window.location.reload()}>
              Try again
            </button>
          ) : (
            "Loading your account…"
          )}
        </div>
      ) : admin ? (
        <>
          {user.aal !== "aal2" ? (
            <MfaPanel onVerified={() => window.location.reload()} />
          ) : (
            <>
              <section className="account-panel staff-access-summary">
                <ShieldCheck size={28} />
                <div>
                  <h2>Authenticator verified</h2>
                  <p>
                    {user.role === "admin"
                      ? "Administrator access is active for this session."
                      : "Support access is active. Administrative settings and staff management remain restricted."}
                  </p>
                </div>
                <span className="account-role">{user.role}</span>
              </section>
              {user.role === "admin" ? (
                <StaffPanel currentId={user.id} />
              ) : (
                <section className="account-panel">
                  <h2>Support workspace</h2>
                  <p>
                    Your role is protected. Student, order and refund-review tools are available in
                    the team workspace.
                  </p>
                </section>
              )}
            </>
          )}
          <Link className="text-link" href="/account">
            Manage your own account <ArrowUpRight size={17} />
          </Link>
          <Link className="button button-primary" href="/admin">
            Open team workspace <ArrowUpRight size={17} />
          </Link>
        </>
      ) : (
        <div className="account-grid">
          <div>
            <section className="account-panel">
              <div className="account-panel-heading">
                <UserCircle size={23} />
                <h2>Profile details</h2>
              </div>
              <form className="auth-form" onSubmit={profile}>
                <label htmlFor="profile-name">
                  Full name
                  <input
                    id="profile-name"
                    name="name"
                    required
                    maxLength={80}
                    defaultValue={user.name}
                  />
                </label>
                <label htmlFor="profile-email">
                  Verified email
                  <input id="profile-email" type="email" readOnly value={user.email} />
                </label>
                <label htmlFor="profile-phone">
                  Phone <span className="field-optional">(optional)</span>
                  <input
                    id="profile-phone"
                    name="phone"
                    type="tel"
                    maxLength={25}
                    defaultValue={user.phone ?? ""}
                  />
                </label>
                <button className="button button-primary" disabled={pending}>
                  Save profile
                </button>
              </form>
            </section>
            <section className="account-panel">
              <h2>Change password</h2>
              <p>After changing your password, sign in again on your devices.</p>
              <form className="auth-form" onSubmit={password}>
                <label htmlFor="current-password">
                  Current password
                  <input
                    id="current-password"
                    name="current"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label htmlFor="new-password">
                  New password
                  <input
                    id="new-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                  />
                </label>
                <label htmlFor="repeat-password">
                  Confirm new password
                  <input
                    id="repeat-password"
                    name="confirmation"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                  />
                </label>
                <p className="auth-field-help">
                  Use at least 12 characters, including uppercase, lowercase and a number.
                </p>
                <button className="button button-secondary" disabled={pending}>
                  Update password
                </button>
              </form>
            </section>
          </div>
          <div>
            <section className="account-panel">
              <div className="account-panel-heading">
                <Devices size={23} />
                <h2>Active devices</h2>
              </div>
              <p>
                Up to two devices can be active. Signing out a device stops its account access
                immediately.
              </p>
              <div className="device-list">
                {devices.map((device) => (
                  <div className="device-row" key={device.id}>
                    <div>
                      <strong>
                        {device.name}
                        {device.current && <span className="device-current">This device</span>}
                      </strong>
                      <small>
                        {new Date(device.lastActive).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })}{" "}
                        IST
                      </small>
                    </div>
                    <button
                      className="button button-secondary"
                      disabled={pending}
                      onClick={() => revoke(device.id)}
                    >
                      Sign out
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="button button-secondary"
                disabled={pending}
                onClick={() => logout(true)}
              >
                Sign out all devices
              </button>
            </section>
            <section className="account-panel">
              <h2>Your next learning step</h2>
              <p>
                Open your enrolled courses, continue a lesson or review your learning progress. New
                purchases remain unavailable in this preview.
              </p>
              <Link className="button button-primary" href="/learn">
                My learning <ArrowUpRight size={17} />
              </Link>
            </section>
            {["admin", "support"].includes(user.role) && (
              <section className="account-panel">
                <h2>Team access</h2>
                <p>Staff operations require authenticator verification.</p>
                <Link className="text-link" href="/admin">
                  Open team workspace <ArrowUpRight size={17} />
                </Link>
              </section>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
