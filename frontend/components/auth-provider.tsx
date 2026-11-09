"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AUTH_CHANGE_KEY, notifyAuthChange } from "../lib/auth-events";

type AuthUser = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: "admin" | "student" | "support";
  aal?: string;
};
type AuthFailure = { message: string; code?: string; status?: number };
type AuthState = {
  user: AuthUser | null;
  ready: boolean;
  error: AuthFailure | null;
  pathname?: string;
  invalidated?: boolean;
};
const initialState: AuthState = { user: null, ready: false, error: null };
const AuthContext = createContext<AuthState & { clear: () => void; refresh: () => Promise<void> }>({
  ...initialState,
  clear: () => {},
  refresh: async () => {},
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
    setState({ user: null, ready: true, error: null, pathname });
    notifyAuthChange();
  }, [pathname]);

  const refresh = useCallback(() => {
    if (pending.current?.pathname === pathname) return pending.current.request;
    const current = ++version.current;
    const request = fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok)
          throw Object.assign(
            new Error(data?.error || "Session could not be checked. Please try again."),
            {
              code: data?.code,
              status: response.status,
            },
          );
        return data;
      })
      .then((data) => {
        if (mounted.current && current === version.current)
          setState({ user: data?.user ?? null, ready: true, error: null, pathname });
      })
      .catch((reason: AuthFailure) => {
        if (mounted.current && current === version.current)
          setState({
            user: null,
            ready: true,
            error: {
              message: reason?.message || "Session could not be checked. Please try again.",
              code: reason?.code,
              status: reason?.status,
            },
            pathname,
          });
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
    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_CHANGE_KEY && event.key !== null) return;
      version.current++;
      pending.current = null;
      setState({ user: null, ready: false, error: null, invalidated: true });
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{ ...state, ready: state.ready && state.pathname === pathname, clear, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}
