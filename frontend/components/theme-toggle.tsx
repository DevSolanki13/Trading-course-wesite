"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "@phosphor-icons/react";

const subscribe = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("theme-change", callback);
  return () => window.removeEventListener("theme-change", callback);
};

const getTheme = () => {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme ?? "dark";
};

const getServerTheme = () => "dark";

export function ThemeToggle({
  className = "icon-button theme-toggle",
  size = 19,
}: {
  className?: string;
  size?: number;
}) {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = next;
      const favicons = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]');
      favicons.forEach((fav) => {
        fav.href = next === "light" ? "/favicon-light.png" : "/favicon-dark.png";
      });
    }
    try {
      localStorage.setItem("market-method-theme", next);
    } catch {
      /* Storage is optional */
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("theme-change"));
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      <Sun size={size} className="sun-icon" />
      <Moon size={size} className="moon-icon" />
    </button>
  );
}
