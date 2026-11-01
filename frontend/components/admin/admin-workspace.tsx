"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MfaPanel } from "../mfa-panel";
import { BullMark } from "../bull-mark";
import { ThemeToggle } from "../theme-toggle";
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
  Gear,
  CaretDown,
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
  const [view, setView] = useState<string>("courses");
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  }
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
        if (d.user.role === "support") {
          setView((prev) => (prev === "courses" ? "overview" : prev));
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
  if (user.aal !== "aal2" && user.aal !== "local-demo")
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
  const workspaceItems = views.filter((item) => ["overview", "courses", "students"].includes(item.id));
  const commerceItems = views.filter((item) => ["orders", "refunds", "coupons"].includes(item.id));
  const manageItems = views.filter((item) => ["content", "settings", "operations", "audit"].includes(item.id));
  const renderNavItems = (items: typeof views) =>
    items.map(({ id, label, Icon }) => (
      <button
        key={id}
        className={view === id ? "is-active" : ""}
        aria-current={view === id ? "page" : undefined}
        onClick={() => setView(id)}
      >
        <Icon size={18} weight={view === id ? "fill" : "regular"} />
        {label}
      </button>
    ));
  return (
    <main id="main-content" className="admin-page">
      <aside className="admin-sidebar" aria-label="Admin sections">
        <Link href="/" className="admin-brand" aria-label="GlobalBulls storefront">
          <BullMark className="admin-brand-mark" />
          <span>Global<span>Bulls</span></span>
        </Link>
        <button type="button" className="admin-workspace-switcher">
          <span>Admin workspace</span><CaretDown size={16} />
        </button>
        <div className="admin-nav-group">
          <span className="admin-nav-label">Workspace</span>
          {renderNavItems(workspaceItems)}
        </div>
        <div className="admin-nav-group">
          <span className="admin-nav-label">Commerce</span>
          {renderNavItems(commerceItems)}
        </div>
        <div className="admin-nav-group">
          <span className="admin-nav-label">Manage</span>
          {renderNavItems(manageItems)}
        </div>
        <div className="admin-sidebar-bottom">
          <Link href="/"><ArrowUUpLeft size={18} /> View storefront</Link>
          <Link href="/account" className="admin-user-menu" aria-label="Open account settings">
            <span className="admin-avatar">{user.email.slice(0, 1).toUpperCase()}</span>
            <span><strong>Admin</strong><small>{loggingOut ? "Signing out…" : "Edit account"}</small></span>
            <CaretDown size={15} />
          </Link>
          <button type="button" className="admin-signout" disabled={loggingOut} onClick={() => void logout()}>{loggingOut ? "Signing out…" : "Sign out"}</button>
        </div>
      </aside>
      <div className="admin-content">
        <header className="admin-top">
          <div className="admin-breadcrumb">
            <span>Admin</span>
            <span>/</span>
            <strong>{views.find((v) => v.id === view)?.label ?? "Workspace"}</strong>
          </div>
          <div className="admin-top-actions">
            <ThemeToggle />
          </div>
        </header>
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
