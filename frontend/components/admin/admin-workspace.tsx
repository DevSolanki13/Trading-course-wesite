"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { MfaPanel } from "../mfa-panel";
import { BullMark } from "../bull-mark";
import { ThemeToggle } from "../theme-toggle";
const CourseManager = dynamic(() =>
  import("./course-manager").then((module) => module.CourseManager),
);
const OverviewPanel = dynamic(() =>
  import("./overview-panel").then((module) => module.OverviewPanel),
);
const StudentsPanel = dynamic(() =>
  import("./students-panel").then((module) => module.StudentsPanel),
);
const OrdersPanel = dynamic(() => import("./orders-panel").then((module) => module.OrdersPanel));
const UpiPaymentsPanel = dynamic(() =>
  import("./upi-payments-panel").then((module) => module.UpiPaymentsPanel),
);
const RefundsPanel = dynamic(() => import("./refunds-panel").then((module) => module.RefundsPanel));
const SettingsPanel = dynamic(() =>
  import("./settings-panel").then((module) => module.SettingsPanel),
);
const CouponsPanel = dynamic(() => import("./coupons-panel").then((module) => module.CouponsPanel));
const AnnouncementsPanel = dynamic(() =>
  import("./announcements-panel").then((module) => module.AnnouncementsPanel),
);
const AdminProfilePanel = dynamic(() =>
  import("./admin-profile-panel").then((module) => module.AdminProfilePanel),
);
const TeamPanel = dynamic(() => import("./team-panel").then((module) => module.TeamPanel));
const ContentPanel = dynamic(() => import("./content-panel").then((module) => module.ContentPanel));
const OperationsPanel = dynamic(() =>
  import("./operations-panel").then((module) => module.OperationsPanel),
);
import {
  ChartBar,
  Books,
  Users,
  Receipt,
  Bank,
  ArrowUUpLeft,
  Gear,
  CaretDown,
  Ticket,
  ClipboardText,
  UserCircle,
  ShieldCheck,
  SignOut,
  MegaphoneSimple,
  Article,
  Pulse,
  List,
  X,
} from "@phosphor-icons/react";
import { AdminWorkspaceSkeleton } from "./admin-skeletons";

type User = {
  id?: string;
  name?: string;
  email: string;
  phone?: string | null;
  role: "admin" | "support" | "student";
  aal: string;
};
const allViews = [
  { id: "overview", label: "Overview", Icon: ChartBar },
  { id: "courses", label: "Courses", Icon: Books, admin: true },
  { id: "students", label: "Students", Icon: Users },
  { id: "orders", label: "Orders", Icon: Receipt },
  { id: "payments", label: "UPI payments", Icon: Bank, admin: true },
  { id: "refunds", label: "Refunds", Icon: ClipboardText },
  { id: "coupons", label: "Coupons", Icon: Ticket, admin: true },
  { id: "announcements", label: "Announcements", Icon: MegaphoneSimple, admin: true },
  { id: "content", label: "Site content", Icon: Article, admin: true },
  { id: "operations", label: "Operations & audit", Icon: Pulse, admin: true },
  { id: "team", label: "Admins & Team", Icon: ShieldCheck, admin: true },
  { id: "settings", label: "Settings", Icon: Gear, admin: true },
  { id: "profile", label: "Profile & account", Icon: UserCircle },
] as const;
export function AdminWorkspace() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("view");
      if (p && allViews.some((v) => v.id === p)) return p;
    }
    return "courses";
  });
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const handleSelectView = (nextView: string) => {
    setView(nextView);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", nextView);
      window.history.pushState({ view: nextView }, "", url.toString());
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const p = new URLSearchParams(window.location.search).get("view") || "courses";
      if (allViews.some((v) => v.id === p)) {
        setView(p);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Trap focus, close on Escape, lock body scroll, restore focus
  useEffect(() => {
    if (!drawerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (e.key === "Tab" && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    // Initial focus on first interactive element inside drawer
    const timer = setTimeout(() => {
      const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables && focusables.length > 0) {
        focusables[0].focus();
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [drawerOpen]);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("indianxtrade_admin_avatar") ||
        localStorage.getItem("globalbulls_admin_avatar")
      );
    }
    return null;
  });
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onAvatarUpdate = () => {
      setAvatarUrl(
        localStorage.getItem("indianxtrade_admin_avatar") ||
          localStorage.getItem("globalbulls_admin_avatar"),
      );
    };
    window.addEventListener("indianxtrade_avatar_updated", onAvatarUpdate);
    window.addEventListener("globalbulls_avatar_updated", onAvatarUpdate);
    return () => {
      window.removeEventListener("indianxtrade_avatar_updated", onAvatarUpdate);
      window.removeEventListener("globalbulls_avatar_updated", onAvatarUpdate);
    };
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    if (profileMenuOpen) {
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }
  }, [profileMenuOpen]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        setLogoutError("Sign out failed. Please retry.");
        setLoggingOut(false);
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      setLogoutError("Sign out failed. Please retry.");
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
  if (!user) return <AdminWorkspaceSkeleton />;
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
  const workspaceItems = views.filter((item) =>
    ["overview", "courses", "students"].includes(item.id),
  );
  const commerceItems = views.filter((item) =>
    ["orders", "payments", "refunds", "coupons"].includes(item.id),
  );
  const manageItems = views.filter((item) =>
    ["announcements", "content", "operations", "team", "settings"].includes(item.id),
  );
  const renderNavItems = (items: typeof views, onSelect?: () => void) =>
    items.map(({ id, label, Icon }) => (
      <button
        key={id}
        type="button"
        className={view === id ? "is-active" : ""}
        aria-current={view === id ? "page" : undefined}
        onClick={(e) => {
          handleSelectView(id);
          onSelect?.();
          e.currentTarget.focus();
        }}
      >
        <Icon size={18} weight={view === id ? "fill" : "regular"} />
        <span>{label}</span>
      </button>
    ));
  return (
    <main id="main-content" className="admin-page">
      {/* Mobile drawer backdrop */}
      <div
        className={`admin-drawer-overlay ${drawerOpen ? "is-open" : ""}`}
        aria-hidden={!drawerOpen}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Mobile drawer sheet */}
      <aside
        id="admin-drawer"
        className={`admin-drawer ${drawerOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        ref={drawerRef}
      >
        <div className="admin-drawer-header">
          <div
            className="student-workspace-switcher"
            role="status"
            aria-label="Current workspace: Admin"
          >
            <div className="student-workspace-info">
              <ShieldCheck size={17} weight="duotone" color="var(--accent, #00df8f)" />
              <span>Staff workspace</span>
            </div>
            <span className="student-workspace-status">
              <i />
              Active
            </span>
          </div>
          <button
            type="button"
            className="admin-drawer-close"
            aria-label="Close navigation menu"
            onClick={() => {
              setDrawerOpen(false);
              menuButtonRef.current?.focus();
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="admin-drawer-content">
          <div className="admin-nav-group" aria-label="Workspace navigation">
            <span className="admin-nav-label">Workspace</span>
            {renderNavItems(workspaceItems, () => setDrawerOpen(false))}
          </div>
          <div className="admin-nav-group" aria-label="Commerce navigation">
            <span className="admin-nav-label">Commerce</span>
            {renderNavItems(commerceItems, () => setDrawerOpen(false))}
          </div>
          <div className="admin-nav-group" aria-label="Manage navigation">
            <span className="admin-nav-label">Manage</span>
            {renderNavItems(manageItems, () => setDrawerOpen(false))}
          </div>

          <div className="admin-drawer-storefront">
            <Link href="/" onClick={() => setDrawerOpen(false)}>
              <ArrowUUpLeft size={18} /> View storefront
            </Link>
          </div>

          <div className="admin-drawer-account">
            <div className="admin-drawer-user-info">
              <span className="admin-avatar">
                {avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={avatarUrl} alt="Avatar" />
                ) : (
                  (user.name?.trim().charAt(0) || user.email.slice(0, 1)).toUpperCase()
                )}
              </span>
              <div className="admin-drawer-user-details">
                <strong>{user.name || "Admin"}</strong>
                <small>{user.email}</small>
              </div>
            </div>

            <div className="admin-drawer-account-links">
              <button
                type="button"
                className={`admin-popover-item ${view === "profile" ? "is-active" : ""}`}
                onClick={() => {
                  handleSelectView("profile");
                  setDrawerOpen(false);
                }}
              >
                <UserCircle size={16} />
                <span>Edit profile & credentials</span>
              </button>

              <button
                type="button"
                className={`admin-popover-item ${view === "settings" ? "is-active" : ""}`}
                onClick={() => {
                  handleSelectView("settings");
                  setDrawerOpen(false);
                }}
              >
                <Gear size={16} />
                <span>Platform settings</span>
              </button>

              <Link
                href="/admin/security"
                className="admin-popover-item"
                onClick={() => setDrawerOpen(false)}
              >
                <ShieldCheck size={16} />
                <span>Team security & 2FA</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="admin-drawer-footer">
          {logoutError && (
            <p role="alert" className="auth-error admin-logout-error">
              {logoutError}
            </p>
          )}
          <button
            type="button"
            className="admin-signout"
            disabled={loggingOut}
            onClick={() => void logout()}
          >
            <SignOut size={16} />
            <span>{loggingOut ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="admin-sidebar" aria-label="Admin sections">
        <Link href="/" className="admin-brand" aria-label="indianXtrade storefront">
          <BullMark className="admin-brand-mark" height={54} />
        </Link>
        <div
          className="student-workspace-switcher"
          role="status"
          aria-label="Current workspace: Admin"
        >
          <div className="student-workspace-info">
            <ShieldCheck size={17} weight="duotone" color="var(--accent, #00df8f)" />
            <span>Staff workspace</span>
          </div>
          <span className="student-workspace-status">
            <i />
            Active
          </span>
        </div>
        <div className="admin-nav-group" aria-label="Workspace navigation">
          <span className="admin-nav-label">Workspace</span>
          {renderNavItems(workspaceItems)}
        </div>
        <div className="admin-nav-group" aria-label="Commerce navigation">
          <span className="admin-nav-label">Commerce</span>
          {renderNavItems(commerceItems)}
        </div>
        <div className="admin-nav-group" aria-label="Manage navigation">
          <span className="admin-nav-label">Manage</span>
          {renderNavItems(manageItems)}
        </div>
        <div className="admin-sidebar-bottom">
          <Link href="/">
            <ArrowUUpLeft size={18} /> View storefront
          </Link>
          <div className="admin-user-menu-container" ref={profileMenuRef}>
            <button
              type="button"
              className={`admin-user-menu ${profileMenuOpen || view === "profile" ? "is-open" : ""}`}
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              aria-label="Open profile settings menu"
              aria-expanded={profileMenuOpen}
            >
              <span className="admin-avatar">
                {avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={avatarUrl} alt="Avatar" />
                ) : (
                  (user.name?.trim().charAt(0) || user.email.slice(0, 1)).toUpperCase()
                )}
              </span>
              <span>
                <strong>{user.name || "Admin"}</strong>
                <small>{loggingOut ? "Signing out…" : "Edit account"}</small>
              </span>
              <CaretDown
                size={15}
                style={{
                  transform: profileMenuOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s ease",
                }}
              />
            </button>

            {profileMenuOpen && (
              <div className="admin-user-popover" aria-label="Administrator account options">
                <div className="admin-popover-header">
                  <div className="admin-avatar">
                    {avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={avatarUrl} alt="Avatar" />
                    ) : (
                      (user.name?.trim().charAt(0) || user.email.slice(0, 1)).toUpperCase()
                    )}
                  </div>
                  <div className="admin-popover-info">
                    <span className="admin-popover-name">{user.name || "Administrator"}</span>
                    <span className="admin-popover-email">{user.email}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className={`admin-popover-item ${view === "profile" ? "is-active" : ""}`}
                  onClick={() => {
                    handleSelectView("profile");
                    setProfileMenuOpen(false);
                  }}
                >
                  <UserCircle size={16} />
                  <span>Edit profile & credentials</span>
                </button>

                <button
                  type="button"
                  className={`admin-popover-item ${view === "settings" ? "is-active" : ""}`}
                  onClick={() => {
                    handleSelectView("settings");
                    setProfileMenuOpen(false);
                  }}
                >
                  <Gear size={16} />
                  <span>Platform settings</span>
                </button>

                <Link
                  href="/admin/security"
                  className="admin-popover-item"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  <ShieldCheck size={16} />
                  <span>Team security & 2FA</span>
                </Link>

                <div className="admin-popover-divider" />

                {logoutError && (
                  <p role="alert" className="auth-error admin-logout-error">
                    {logoutError}
                  </p>
                )}

                <button
                  type="button"
                  className="admin-popover-item"
                  disabled={loggingOut}
                  onClick={() => void logout()}
                  style={{ color: "#ef4444" }}
                >
                  <SignOut size={16} />
                  <span>{loggingOut ? "Signing out…" : "Sign out"}</span>
                </button>
              </div>
            )}
          </div>
          {logoutError && (
            <p role="alert" className="auth-error admin-logout-error">
              {logoutError}
            </p>
          )}
          <button
            type="button"
            className="admin-signout"
            disabled={loggingOut}
            onClick={() => void logout()}
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>
      <div className="admin-content">
        <header className="admin-top">
          <div className="admin-top-left">
            <button
              type="button"
              className="admin-menu-toggle"
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              aria-controls="admin-drawer"
              onClick={() => setDrawerOpen(true)}
              ref={menuButtonRef}
            >
              <List size={22} weight="bold" />
            </button>
            <Link href="/" className="admin-brand-mobile" aria-label="indianXtrade storefront">
              <BullMark className="admin-brand-mark" height={32} />
            </Link>
            <div className="admin-breadcrumb">
              <span>Admin</span>
              <span>/</span>
              <strong>{views.find((v) => v.id === view)?.label ?? "Workspace"}</strong>
            </div>
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
          {view === "payments" && user.role === "admin" && <UpiPaymentsPanel />}
          {view === "refunds" && <RefundsPanel role={user.role as "admin" | "support"} />}
          {view === "coupons" && user.role === "admin" && <CouponsPanel />}
          {view === "announcements" && user.role === "admin" && <AnnouncementsPanel />}
          {view === "content" && user.role === "admin" && <ContentPanel />}
          {view === "operations" && user.role === "admin" && <OperationsPanel view="operations" />}
          {view === "team" && user.role === "admin" && <TeamPanel currentUserId={user.id} />}
          {view === "settings" && user.role === "admin" && <SettingsPanel />}
          {view === "profile" && (
            <AdminProfilePanel
              user={user}
              onProfileUpdated={(updated) => {
                setUser((prev) => (prev ? { ...prev, ...updated } : prev));
              }}
            />
          )}
        </div>
      </div>
    </main>
  );
}
