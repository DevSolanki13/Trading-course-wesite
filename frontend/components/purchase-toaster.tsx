"use client";
import { useSyncExternalStore } from "react";
import { Toaster } from "sonner";
const subscribe = (callback: () => void) => {
  window.addEventListener("theme-change", callback);
  return () => window.removeEventListener("theme-change", callback);
};
export function PurchaseToaster() {
  const theme = useSyncExternalStore<"light" | "dark">(
    subscribe,
    () => (document.documentElement.dataset.theme === "light" ? "light" : "dark"),
    () => "dark",
  );
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      closeButton
      toastOptions={{
        style: {
          background: "var(--surface)",
          color: "var(--foreground)",
          border: "1px solid var(--line)",
        },
      }}
    />
  );
}
