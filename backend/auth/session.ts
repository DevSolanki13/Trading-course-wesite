import "server-only";
import { cookies } from "next/headers";
import { createAdminClient, createRequestClient } from "../database/supabase";
import { AuthError } from "./http";
import { deviceName, isPrivileged, safeNext } from "./policy";
import { cookiePolicy } from "./cookies";

export async function identity() {
  const client = await createRequestClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new AuthError(401, "Please sign in to continue.", "SIGN_IN_REQUIRED");
  if (!user.email_confirmed_at)
    throw new AuthError(403, "Verify your email before signing in.", "EMAIL_UNVERIFIED");
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session)
    throw new AuthError(401, "Your session has expired. Please sign in again.", "SIGN_IN_REQUIRED");
  let claims;
  try {
    claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString());
  } catch {
    throw new AuthError(401, "Invalid session.");
  }
  if (
    claims.sub !== user.id ||
    !/^[0-9a-f-]{36}$/i.test(claims.session_id ?? "") ||
    claims.exp * 1000 <= Date.now()
  )
    throw new AuthError(401, "Your session has expired.");
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,full_name,phone,role,blocked")
    .eq("id", user.id)
    .single();
  if (profileError) throw new AuthError(503, "Account information is temporarily unavailable.");
  if (profile.blocked)
    throw new AuthError(403, "This account is unavailable. Contact support.", "ACCOUNT_BLOCKED");
  return {
    client,
    admin,
    user,
    profile,
    sessionId: claims.session_id as string,
    aal: claims.aal as string,
    accessToken: session.access_token,
  };
}
export type Identity = Awaited<ReturnType<typeof identity>>;

export async function admitted() {
  const context = await identity();
  const { data, error } = await context.admin.rpc("auth_has_session", {
    p_user: context.user.id,
    p_session: context.sessionId,
  });
  if (error) throw new AuthError(503, "Session protection is temporarily unavailable.");
  if (data !== true) {
    const { data: device } = await context.admin
      .from("device_sessions")
      .select("revoked_at,expires_at,admitted_at")
      .eq("user_id", context.user.id)
      .eq("auth_session_id", context.sessionId)
      .maybeSingle();
    if (
      device &&
      !device.revoked_at &&
      Date.parse(device.expires_at) > Date.now() &&
      !device.admitted_at
    )
      throw new AuthError(409, "Choose a device to sign out before continuing.", "DEVICE_LIMIT");
    throw new AuthError(401, "This session has ended. Please sign in again.", "SESSION_REVOKED");
  }
  const { error: activityError } = await context.admin
    .from("device_sessions")
    .update({ last_active_at: new Date().toISOString() })
    .eq("user_id", context.user.id)
    .eq("auth_session_id", context.sessionId)
    .lt("last_active_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());
  if (activityError) throw new AuthError(503, "Device activity could not be recorded.");
  return context;
}

export async function privileged(adminOnly = false) {
  const context = await admitted();
  if (adminOnly ? context.profile.role !== "admin" : !isPrivileged(context.profile.role))
    throw new AuthError(403, "You do not have permission for this action.", "FORBIDDEN");
  if (context.aal !== "aal2")
    throw new AuthError(403, "Verify an authenticator code to continue.", "MFA_REQUIRED");
  return context;
}

export async function admission(
  context: Identity,
  request: Request,
  replace: string | null = null,
) {
  const remember = (await cookies()).get("mm_remember")?.value === "1";
  const { data, error } = await context.admin.rpc("auth_admit_device", {
    p_user: context.user.id,
    p_session: context.sessionId,
    p_name: deviceName(request.headers.get("user-agent") ?? ""),
    p_remember: remember,
    p_replace: replace,
  });
  if (error) throw new AuthError(503, "Device admission is temporarily unavailable.");
  if (data === "blocked" || data === "revoked")
    throw new AuthError(401, "This session has ended. Please sign in again.", "SESSION_REVOKED");
  if (data === "invalid_device")
    throw new AuthError(400, "That device is no longer available. Refresh and try again.");
  return data as "admitted" | "limit";
}

export async function setRemember(remember: boolean) {
  (await cookies()).set("mm_remember", remember ? "1" : "0", cookiePolicy(remember));
}
export function destination(state: string, next: unknown, context: Identity) {
  if (state === "limit") return `/auth/devices?next=${encodeURIComponent(safeNext(next))}`;
  return safeNext(next, isPrivileged(context.profile.role) ? "/admin" : "/account");
}
export async function audit(context: Identity, action: string, target: string) {
  const { error } = await context.admin
    .from("audit_log")
    .insert({ actor_id: context.user.id, action, target_type: "account", target_id: target });
  if (error) throw new AuthError(503, "Security logging is temporarily unavailable.");
}
