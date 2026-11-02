"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  List,
  X,
  User as UserIcon,
  SignOut,
  Books,
  ShieldCheck,
  Receipt,
  Gear,
} from "@phosphor-icons/react";
import { BullMark } from "./bull-mark";
import { useAuth } from "./auth-provider";

const baseLinks = [{ href: "/courses", label: "Courses" }];

import { ThemeToggle } from "./theme-toggle";
export { ThemeToggle };

export function Brand({ footer = false }: { footer?: boolean }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  return (
    <Link
      href={isAdmin ? "/admin" : "/"}
      className={`brand ${footer ? "brand-footer" : ""}`}
      aria-label="GlobalBulls home"
    >
      <BullMark className="brand-bull-mark" />
      <span>
        <span className="brand-light">Global</span>Bulls
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setProfileOpen(false);
  }
  const { user, clear } = useAuth();
  const signedIn = !!user;
  const role = user?.role ?? null;
  const [scrolled, setScrolled] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setProfileOpen(false);
    }
    if (profileOpen) {
      document.addEventListener("mousedown", onDocClick);
      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.removeEventListener("mousedown", onDocClick);
        document.removeEventListener("keydown", onKeyDown);
      };
    }
  }, [profileOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);

  useEffect(() => {
    if (signedIn && role === "admin") {
      if (pathname === "/" || pathname === "/courses" || pathname.startsWith("/courses/")) {
        router.replace("/admin");
      }
    }
  }, [signedIn, role, pathname, router]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      clear();
      setProfileOpen(false);
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  }

  const navLinks =
    signedIn && role === "admin"
      ? [{ href: "/admin", label: "Admin workspace" }]
      : baseLinks;

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="container header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label="Main navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <ThemeToggle />
            {signedIn && user ? (
              <div className="profile-menu-container" ref={profileRef}>
                <button
                  type="button"
                  className="profile-avatar-button"
                  aria-label="Account details"
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((prev) => !prev)}
                >
                  {user.name?.trim().charAt(0).toUpperCase() ||
                    user.email?.trim().charAt(0).toUpperCase() || <UserIcon size={18} />}
                </button>
                {profileOpen && (
                  <div className="profile-dropdown-card" role="menu">
                    <div className="profile-dropdown-header">
                      <div className="profile-dropdown-avatar">
                        {user.name?.trim().charAt(0).toUpperCase() ||
                          user.email?.trim().charAt(0).toUpperCase() || <UserIcon size={20} />}
                      </div>
                      <div className="profile-dropdown-info">
                        <span className="profile-dropdown-name">{user.name || "User"}</span>
                        <span className="profile-dropdown-email">{user.email || ""}</span>
                        <span className="profile-dropdown-role">
                          {user.role === "admin"
                            ? "Administrator"
                            : user.role === "support"
                              ? "Support"
                              : "Student"}
                        </span>
                      </div>
                    </div>
                    <div className="profile-dropdown-links">
                      {user.role === "admin" ? (
                        <>
                          <Link
                            href="/admin"
                            className="profile-dropdown-item"
                            onClick={() => setProfileOpen(false)}
                          >
                            <Gear size={17} /> Admin workspace
                          </Link>
                          <Link
                            href="/admin/security"
                            className="profile-dropdown-item"
                            onClick={() => setProfileOpen(false)}
                          >
                            <ShieldCheck size={17} /> Team security
                          </Link>
                        </>
                      ) : (
                        <>
                          <Link
                            href="/dashboard"
                            className="profile-dropdown-item"
                            onClick={() => setProfileOpen(false)}
                          >
                            <Books size={17} /> My courses
                          </Link>
                          <Link
                            href="/dashboard/orders"
                            className="profile-dropdown-item"
                            onClick={() => setProfileOpen(false)}
                          >
                            <Receipt size={17} /> Purchase history
                          </Link>
                          <Link
                            href="/courses"
                            className="profile-dropdown-item"
                            onClick={() => setProfileOpen(false)}
                          >
                            <Books size={17} /> Explore courses
                          </Link>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      className="profile-dropdown-logout"
                      onClick={() => void logout()}
                    >
                      <SignOut size={17} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link className="login-link" href="/login">
                Log in <ArrowUpRight size={15} />
              </Link>
            )}
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger asChild>
                <button className="icon-button mobile-menu-button" aria-label="Open navigation">
                  <List size={23} />
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="dialog-overlay" />
                <Dialog.Content className="mobile-menu">
                  <div className="menu-heading">
                    <Dialog.Title>Explore GlobalBulls</Dialog.Title>
                    <Dialog.Close className="icon-button" aria-label="Close navigation">
                      <X size={22} />
                    </Dialog.Close>
                  </div>
                  <Dialog.Description className="sr-only">
                    Choose a page to visit.
                  </Dialog.Description>
                  <nav aria-label="Mobile navigation">
                    {(signedIn && role === "admin"
                      ? [{ href: "/admin", label: "Admin workspace" }]
                      : [
                          ...navLinks,
                          ...(signedIn
                            ? [
                                {
                                  href: "/dashboard",
                                  label: "My courses",
                                },
                              ]
                            : [{ href: "/login", label: "Log in" }]),
                        ]
                    ).map((link) => (
                      <Dialog.Close key={link.href} asChild>
                        <Link
                          href={link.href}
                          aria-current={pathname === link.href ? "page" : undefined}
                        >
                          {link.label}
                          <ArrowUpRight size={21} />
                        </Link>
                      </Dialog.Close>
                    ))}
                  </nav>
                  <p>
                    Learn the process.
                    <br />
                    Respect the risk.
                  </p>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </div>
      </header>
    </>
  );
}
