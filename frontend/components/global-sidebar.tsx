"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  House,
  Compass,
  Books,
  Receipt,
  UserCircle,
  Gear,
  SignIn,
  UserPlus,
  SignOut,
  List,
  X,
  GraduationCap,
} from "@phosphor-icons/react";
import { BullMark } from "./bull-mark";
import { useAuth } from "./auth-provider";
import { ThemeToggle } from "./theme-toggle";

export function GlobalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clear } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Close mobile drawer on route change
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  // Navigation sidebar should ONLY appear after logging in
  if (!user) {
    return null;
  }

  // Hide navigation bar on the landing page, and don't double-render on pages with their own dedicated workspace sidebar
  const isLandingPage = pathname === "/";
  const hasDedicatedSidebar =
    pathname.startsWith("/admin") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/learn/");

  if (isLandingPage || hasDedicatedSidebar) {
    return null;
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      clear();
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  }

  const sidebarContent = (
    <>
      <div className="global-sidebar-top">
        <Link href="/" className="admin-brand" aria-label="indianXtrade storefront">
          <BullMark className="admin-brand-mark" height={54} />
        </Link>

        {user && (
          <div className="student-workspace-switcher" role="status" aria-label="Account status">
            <div className="student-workspace-info">
              <GraduationCap size={17} weight="duotone" color="var(--accent, #00df8f)" />
              <span>{user.role === "admin" ? "Staff workspace" : "Learning portal"}</span>
            </div>
            <span className="student-workspace-status">
              <i />
              Active
            </span>
          </div>
        )}
      </div>

      <nav className="global-sidebar-nav" aria-label="Site navigation">
        {/* EXPLORE */}
        <div className="admin-nav-group">
          <span className="admin-nav-label">Explore</span>
          <Link
            href="/"
            className={pathname === "/" ? "is-active" : ""}
            aria-current={pathname === "/" ? "page" : undefined}
          >
            <House size={18} weight={pathname === "/" ? "fill" : "regular"} />
            <span>Home</span>
          </Link>
          <Link
            href="/courses"
            className={pathname.startsWith("/courses") ? "is-active" : ""}
            aria-current={pathname.startsWith("/courses") ? "page" : undefined}
          >
            <Compass size={18} weight={pathname.startsWith("/courses") ? "fill" : "regular"} />
            <span>Courses</span>
          </Link>
        </div>

        {/* LEARNING / STUDY */}
        {user && (
          <div className="admin-nav-group">
            <span className="admin-nav-label">Learning</span>
            <Link
              href="/dashboard"
              className={pathname === "/dashboard" ? "is-active" : ""}
              aria-current={pathname === "/dashboard" ? "page" : undefined}
            >
              <Books size={18} weight={pathname === "/dashboard" ? "fill" : "regular"} />
              <span>My classroom</span>
            </Link>
            <Link
              href="/dashboard/orders"
              className={pathname.startsWith("/dashboard/orders") ? "is-active" : ""}
              aria-current={pathname.startsWith("/dashboard/orders") ? "page" : undefined}
            >
              <Receipt
                size={18}
                weight={pathname.startsWith("/dashboard/orders") ? "fill" : "regular"}
              />
              <span>Billing & receipts</span>
            </Link>
          </div>
        )}

        {/* ACCOUNT / ACCESS */}
        <div className="admin-nav-group">
          <span className="admin-nav-label">Account</span>
          {user ? (
            <>
              <Link
                href="/account"
                className={pathname.startsWith("/account") ? "is-active" : ""}
                aria-current={pathname.startsWith("/account") ? "page" : undefined}
              >
                <UserCircle
                  size={18}
                  weight={pathname.startsWith("/account") ? "fill" : "regular"}
                />
                <span>Profile & security</span>
              </Link>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className={pathname.startsWith("/admin") ? "is-active" : ""}
                  aria-current={pathname.startsWith("/admin") ? "page" : undefined}
                >
                  <Gear size={18} weight={pathname.startsWith("/admin") ? "fill" : "regular"} />
                  <span>Admin workspace</span>
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={pathname === "/login" ? "is-active" : ""}
                aria-current={pathname === "/login" ? "page" : undefined}
              >
                <SignIn size={18} weight={pathname === "/login" ? "fill" : "regular"} />
                <span>Sign in</span>
              </Link>
              <Link
                href="/signup"
                className={pathname === "/signup" ? "is-active" : ""}
                aria-current={pathname === "/signup" ? "page" : undefined}
              >
                <UserPlus size={18} weight={pathname === "/signup" ? "fill" : "regular"} />
                <span>Create account</span>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* FOOTER CONTROLS */}
      <div className="admin-sidebar-bottom">
        <div className="global-sidebar-theme-item">
          <span>Theme</span>
          <ThemeToggle />
        </div>

        {user ? (
          <div className="global-sidebar-user-block">
            <Link href="/account" className="admin-user-menu" aria-label="Open profile">
              <span className="admin-avatar">
                {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
              </span>
              <span className="global-sidebar-user-info">
                <strong>{user.name || "Student"}</strong>
                <small>{user.email}</small>
              </span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="global-sidebar-signout-btn"
              title="Sign out"
              aria-label="Sign out"
            >
              <SignOut size={16} />
            </button>
          </div>
        ) : (
          <div className="global-sidebar-guest-cta">
            <Link href="/login" className="button button-primary button-sm">
              Sign in to learn
            </Link>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Top Header */}
      <div className="global-mobile-top-bar" aria-label="Mobile navigation header">
        <Link href="/" className="admin-brand" aria-label="indianXtrade storefront">
          <BullMark className="admin-brand-mark" height={54} />
        </Link>
        <div className="global-mobile-actions">
          <ThemeToggle />
          <button
            type="button"
            className="global-mobile-menu-btn"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <List size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="global-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Desktop Persistent Sidebar & Mobile Drawer */}
      <aside
        className={`global-sidebar ${mobileOpen ? "is-mobile-open" : ""}`}
        aria-label="Global side navigation"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
