"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, List, Moon, Sun, X } from "@phosphor-icons/react";

const links = [
  { href: "/courses", label: "Courses" },
  { href: "/about", label: "Our approach" },
  { href: "/contact", label: "Get in touch" },
];
const subscribe = (callback: () => void) => {
  window.addEventListener("theme-change", callback);
  return () => window.removeEventListener("theme-change", callback);
};
const getTheme = () => document.documentElement.dataset.theme ?? "dark";
const getServerTheme = () => "dark";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("market-method-theme", next);
    } catch {
      /* Storage is optional. */
    }
    window.dispatchEvent(new Event("theme-change"));
  }
  return (
    <button
      className="icon-button theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      <Sun size={19} className="sun-icon" />
      <Moon size={19} className="moon-icon" />
    </button>
  );
}

export function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${footer ? "brand-footer" : ""}`}
      aria-label="marketmethod. home"
    >
      <span className="brand-symbol" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        market<span className="brand-light">method</span>
        <span className="brand-period">.</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (active) setSignedIn(data.authenticated === true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname]);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="preview-notice" aria-label="Development preview">
        Preview edition{" "}
        <span>Provisional brand, illustrative courses and prices. Enrolment is not open.</span>
      </aside>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label="Main navigation">
            {links.map((link) => (
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
            <Link className="login-link" href={signedIn ? "/account" : "/login"}>
              {signedIn ? "My account" : "Log in"} <ArrowUpRight size={15} />
            </Link>
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
                    <Dialog.Title>Explore Market Method</Dialog.Title>
                    <Dialog.Close className="icon-button" aria-label="Close navigation">
                      <X size={22} />
                    </Dialog.Close>
                  </div>
                  <Dialog.Description className="sr-only">
                    Choose a page to visit.
                  </Dialog.Description>
                  <nav aria-label="Mobile navigation">
                    {[
                      ...links,
                      {
                        href: signedIn ? "/account" : "/login",
                        label: signedIn ? "My account" : "Log in",
                      },
                    ].map((link) => (
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
