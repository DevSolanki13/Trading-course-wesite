"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MfaPanel } from "../mfa-panel";
import { CourseManager } from "./course-manager";
import { OverviewPanel } from "./overview-panel";
import { StudentsPanel } from "./students-panel";
import { OrdersPanel } from "./orders-panel";
import { RefundsPanel } from "./refunds-panel";
import { SettingsPanel } from "./settings-panel";
import { ContentPanel } from "./content-panel";
import { CouponsPanel } from "./coupons-panel";
import { OperationsPanel } from "./operations-panel";
import {
  ChartBar,
  Books,
  Users,
  Receipt,
  ArrowUUpLeft,
  ShieldCheck,
  Gear,
  Fingerprint,
  Ticket,
  NotePencil,
  ClipboardText,
  List,
} from "@phosphor-icons/react";
type User = { email: string; role: "admin" | "support" | "student"; aal: string };
const allViews = [
  { id: "overview", label: "Overview", Icon: ChartBar },
  { id: "courses", label: "Courses", Icon: Books, admin: true },
  { id: "students", label: "Students", Icon: Users },
  { id: "orders", label: "Orders", Icon: Receipt },
  { id: "refunds", label: "Refunds", Icon: ClipboardText },
  { id: "coupons", label: "Coupons", Icon: Ticket, admin: true },
  { id: "content", label: "Site content", Icon: NotePencil, admin: true },
  { id: "settings", label: "Settings", Icon: Gear, admin: true },
  { id: "operations", label: "Operations", Icon: List, admin: true },
  { id: "audit", label: "Audit", Icon: Fingerprint, admin: true },
] as const;
export function AdminWorkspace() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<string>("overview");
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Object.assign(new Error(d.error), { code: d.code, status: r.status });
        return d;
      })
      .then((d) => {
        if (!live) return;
        if (d.user.role === "student") {
          router.replace("/account");
          return;
        }
        setUser(d.user);
      })
      .catch((e) => {
        if (!live) return;
        if (e.code === "DEVICE_LIMIT") router.replace("/auth/devices?next=%2Fadmin");
        else if (e.status === 401) router.replace("/admin/login?next=%2Fadmin");
        else setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [router]);
  if (error)
    return (
      <main id="main-content" className="container admin-page">
        <p role="alert" className="auth-error">
          {error}
        </p>
        <Link className="text-link" href="/admin/login">
          Staff sign-in
        </Link>
      </main>
    );
  if (!user)
    return (
      <main id="main-content" className="container admin-page">
        <p role="status">Checking staff access…</p>
      </main>
    );
  if (user.aal !== "aal2")
    return (
      <main id="main-content" className="container admin-page">
        <div className="admin-section-head">
          <div>
            <span className="auth-section-label">Team access</span>
            <h1>Verify your authenticator.</h1>
          </div>
          <Link className="text-link" href="/account">
            Account
          </Link>
        </div>
        <MfaPanel onVerified={() => window.location.reload()} />
      </main>
    );
  const views = allViews.filter((v) => !("admin" in v) || user.role === "admin");
  return (
    <main id="main-content" className="container admin-page">
      <header className="admin-top">
        <div>
          <span className="auth-section-label">Market Method · Operations</span>
          <h1>Team workspace</h1>
          <p>
            {user.email} · {user.role} · Authenticator verified
          </p>
        </div>
        <Link href="/admin/security" className="button button-secondary">
          <ShieldCheck size={17} /> Team security
        </Link>
      </header>
      <div className="admin-layout">
        <nav className="admin-sidebar" aria-label="Admin sections">
          {views.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={view === id ? "is-active" : ""}
              aria-current={view === id ? "page" : undefined}
              onClick={() => setView(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
          <Link href="/account">
            <ArrowUUpLeft size={18} /> My account
          </Link>
        </nav>
        <div className="admin-main">
          {view === "overview" && <OverviewPanel />}
          {view === "courses" && user.role === "admin" && <CourseManager />}
          {view === "students" && <StudentsPanel role={user.role as "admin" | "support"} />}
          {view === "orders" && <OrdersPanel role={user.role as "admin" | "support"} />}
          {view === "refunds" && <RefundsPanel role={user.role as "admin" | "support"} />}
          {view === "coupons" && user.role === "admin" && <CouponsPanel />}
          {view === "content" && user.role === "admin" && <ContentPanel />}
          {view === "settings" && user.role === "admin" && <SettingsPanel />}
          {view === "operations" && user.role === "admin" && <OperationsPanel view="operations" />}
          {view === "audit" && user.role === "admin" && <OperationsPanel view="audit" />}
        </div>
      </div>
    </main>
  );
}
