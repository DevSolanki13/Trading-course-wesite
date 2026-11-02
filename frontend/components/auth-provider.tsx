"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type AuthUser = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: "admin" | "student" | "support";
  aal?: string;
};
type AuthState = { user: AuthUser | null; ready: boolean };
const initialState: AuthState = { user: null, ready: false };
const AuthContext = createContext<AuthState & { clear: () => void }>({
  ...initialState,
  clear: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState(initialState);
  const pending = useRef<{ pathname: string; request: Promise<void> } | null>(null);
  const version = useRef(0);
  const mounted = useRef(false);

  const clear = useCallback(() => {
    version.current++;
    pending.current = null;
    setState({ user: null, ready: true });
  }, []);

  const refresh = useCallback(() => {
    if (pending.current?.pathname === pathname) return pending.current.request;
    const current = ++version.current;
    const request = fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (mounted.current && current === version.current)
          setState({ user: data?.user ?? null, ready: true });
      })
      .catch(() => {
        if (mounted.current && current === version.current) setState({ user: null, ready: true });
      })
      .finally(() => {
        if (pending.current?.request === request) pending.current = null;
      });
    pending.current = { pathname, request };
    return request;
  }, [pathname]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return <AuthContext.Provider value={{ ...state, clear }}>{children}</AuthContext.Provider>;
}
