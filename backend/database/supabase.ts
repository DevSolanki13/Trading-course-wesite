import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireEnv } from "../config/env";
import { cookiePolicy } from "../auth/cookies";

/** Service-role access bypasses RLS. Only call after server-side authorisation. */
export function createAdminClient(deadline?: AbortSignal) {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: AbortSignal.any([
              ...(init?.signal ? [init.signal] : []),
              ...(deadline ? [deadline] : []),
              AbortSignal.timeout(15000),
            ]),
          }),
      },
    },
  );
}

/** Server-only cookie client. Identity and admission checks live in backend/auth/session. */
export async function createRequestClient() {
  const cookieStore = await cookies();
  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            const remember = cookieStore.get("mm_remember")?.value === "1";
            cookieStore.set(name, value, {
              ...options,
              ...cookiePolicy(remember),
              maxAge: options.maxAge === 0 ? 0 : remember ? 60 * 60 * 24 * 30 : undefined,
              expires: undefined,
            });
          }
        },
      },
    },
  );
}
