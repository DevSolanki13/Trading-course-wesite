import "server-only";
import { z } from "zod";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient, createRequestClient } from "../database/supabase";
import { requireEnv } from "../config/env";
import { AuthError, appOrigin, body, failure, json, limit, sameOrigin } from "../auth/http";
import {
  identity,
  admitted,
  privileged,
  admission,
  destination,
  setRemember,
  audit,
} from "../auth/session";
import { isPrivileged, safeNext } from "../auth/policy";
import { deliverAuthEmail } from "../auth/email";
import { openToken, tokenDigest } from "../auth/crypto";
import { cookiePolicy } from "../auth/cookies";
import { localDemoEnabled } from "../purchase/mode";
import { localAuthRequest } from "../local/http";

const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128)
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a number.");
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AuthError(
      400,
      result.error.issues[0]?.message ?? "Check the supplied information.",
      "VALIDATION_ERROR",
    );
  return result.data;
}
const genericEmail = {
  message:
    "If this address is eligible, an email will arrive shortly. Check your inbox and spam folder.",
};
async function options() {
  let google = false;
  try {
    const response = await fetch(`${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/auth/v1/settings`, {
      headers: { apikey: requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (response.ok) google = (await response.json()).external?.google === true;
  } catch {}
  return { googleEnabled: google && process.env.GOOGLE_OAUTH_CONFIGURED === "true" };
}

export async function authRequest(request: Request) {
  if (localDemoEnabled()) return localAuthRequest(request);
  try {
    const action = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
    if (request.method !== "GET") sameOrigin(request);
    if (request.method === "GET") {
      if (action === "options") return json(await options());
      if (action === "status") {
        try {
          await admitted();
          return json({ authenticated: true });
        } catch {
          return json({ authenticated: false });
        }
      }
      if (action === "me") {
        const context = await admitted();
        return json({
          user: {
            id: context.user.id,
            name: context.profile.full_name,
            email: context.user.email,
            phone: context.profile.phone,
            role: context.profile.role,
            aal: context.aal,
          },
          sessionId: context.sessionId,
        });
      }
      if (action === "devices") {
        const context = await identity();
        const { data: allowed, error: guardError } = await context.admin.rpc(
          "auth_session_manageable",
          { p_user: context.user.id, p_session: context.sessionId },
        );
        if (guardError) throw new AuthError(503, "Session protection is unavailable.");
        if (!allowed)
          throw new AuthError(
            401,
            "This session has ended. Please sign in again.",
            "SESSION_REVOKED",
          );
        const { data, error } = await context.admin.rpc("auth_list_devices", {
          p_user: context.user.id,
        });
        if (error) throw new AuthError(503, "Devices could not be loaded.");
        return json({
          devices: data.map(
            (device: {
              id: string;
              device_name: string;
              last_active_at: string;
              expires_at: string;
              auth_session_id: string;
            }) => ({
              id: device.id,
              name: device.device_name,
              lastActive: device.last_active_at,
              expiresAt: device.expires_at,
              current: device.auth_session_id === context.sessionId,
            }),
          ),
        });
      }
      if (action === "mfa") {
        const context = await admitted();
        if (!isPrivileged(context.profile.role))
          throw new AuthError(403, "Staff access is required.");
        const { data, error } = await context.client.auth.mfa.listFactors();
        if (error) throw new AuthError(503, "Authenticator information is unavailable.");
        return json({
          aal: context.aal,
          factors: data.totp
            .filter((factor) => factor.status === "verified")
            .map((factor) => ({ id: factor.id, name: factor.friendly_name ?? "Authenticator" })),
        });
      }
      return json({ error: "Not found" }, 404);
    }
    if (request.method === "PATCH" && action === "profile") {
      const context = await admitted();
      const input = parse(
        z
          .object({
            name: z.string().trim().min(1).max(80),
            phone: z
              .string()
              .trim()
              .max(25)
              .regex(/^[+\d ()-]*$/)
              .optional(),
          })
          .strict(),
        await body(request),
      );
      const { error } = await context.admin
        .from("profiles")
        .update({ full_name: input.name, phone: input.phone || null })
        .eq("id", context.user.id);
      if (error) throw new AuthError(503, "Profile could not be saved.");
      await audit(context, "profile_updated", context.user.id);
      return json({ message: "Profile updated." });
    }
    if (request.method === "DELETE" && action === "devices") {
      const context = await admitted();
      const input = parse(z.object({ deviceId: z.string().uuid() }).strict(), await body(request));
      const { error } = await context.admin.rpc("auth_revoke_devices", {
        p_user: context.user.id,
        p_current: context.sessionId,
        p_target: input.deviceId,
        p_all: false,
      });
      if (error) throw new AuthError(503, "Device could not be signed out.");
      return json({ message: "Device signed out." });
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (action === "login") {
      const input = parse(
        z
          .object({
            email,
            password: z.string().min(1).max(128),
            remember: z.boolean().default(false),
            next: z.string().optional(),
            admin: z.boolean().default(false),
          })
          .strict(),
        await body(request),
      );
      await limit(request, "login-ip", "", 60);
      await limit(request, "login-account", input.email, 10);
      await setRemember(input.remember);
      const client = await createRequestClient();
      const { error } = await client.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      if (error)
        throw new AuthError(
          401,
          "Email or password was not accepted. Verify your email or try again.",
          "INVALID_CREDENTIALS",
        );
      const context = await identity();
      if (input.admin && !isPrivileged(context.profile.role)) {
        await client.auth.signOut({ scope: "local" });
        throw new AuthError(403, "Administrator or support access is required.", "FORBIDDEN");
      }
      const state = await admission(context, request);
      return json({
        redirect: destination(state, input.next ?? (input.admin ? "/admin" : undefined), context),
      });
    }
    if (action === "signup") {
      const input = parse(
        z
          .object({
            name: z.string().trim().min(1).max(80),
            email,
            password,
            phone: z
              .string()
              .max(25)
              .regex(/^[+\d ()-]*$/)
              .optional(),
            next: z.string().optional(),
          })
          .strict(),
        await body(request),
      );
      await limit(request, "signup-ip", "", 20, 3600);
      await limit(request, "signup-email", input.email, 3, 3600);
      requireEnv("RESEND_API_KEY");
      requireEnv("RESEND_FROM_EMAIL");
      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.generateLink({
        type: "signup",
        email: input.email,
        password: input.password,
        options: { data: { full_name: input.name } },
      });
      if (!error && data.user && data.properties?.hashed_token) {
        if (input.phone)
          await admin.from("profiles").update({ phone: input.phone }).eq("id", data.user.id);
        try {
          await deliverAuthEmail({
            userId: data.user.id,
            email: input.email,
            providerHash: data.properties.hashed_token,
            purpose: "signup",
            next: input.next,
          });
        } catch {
          /* Keep identical public responses for existing and new addresses; delivery failure is recorded. */
        }
      }
      return json(genericEmail, 202);
    }
    if (action === "forgot-password") {
      const input = parse(z.object({ email }).strict(), await body(request));
      await limit(request, "reset-ip", "", 20, 3600);
      await limit(request, "reset-email", input.email, 3, 3600);
      requireEnv("RESEND_API_KEY");
      requireEnv("RESEND_FROM_EMAIL");
      const { data, error } = await createAdminClient().auth.admin.generateLink({
        type: "recovery",
        email: input.email,
      });
      if (!error && data.user && data.properties?.hashed_token) {
        try {
          await deliverAuthEmail({
            userId: data.user.id,
            email: input.email,
            providerHash: data.properties.hashed_token,
            purpose: "recovery",
          });
        } catch {
          /* Generic response prevents address enumeration. */
        }
      }
      return json(genericEmail, 202);
    }
    if (action === "confirm") {
      const input = parse(
        z
          .object({
            token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
            remember: z.boolean().default(false),
          })
          .strict(),
        await body(request),
      );
      await limit(request, "confirm", "", 30);
      const admin = createAdminClient();
      const { data: actionRow, error } = await admin
        .from("auth_email_actions")
        .update({ consumed_at: new Date().toISOString() })
        .eq("nonce_hash", tokenDigest(input.token))
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .select("user_id,token_ciphertext,purpose,next_path")
        .maybeSingle();
      if (error) throw new AuthError(503, "Email confirmation is temporarily unavailable.");
      if (!actionRow)
        throw new AuthError(
          400,
          "This link expired or has already been used. Request a new email.",
          "LINK_EXPIRED",
        );
      await setRemember(input.remember);
      const client = await createRequestClient();
      const { data: verified, error: verifyError } = await client.auth.verifyOtp({
        token_hash: openToken(actionRow.token_ciphertext, requireEnv("SUPABASE_SERVICE_ROLE_KEY")),
        type: actionRow.purpose,
      });
      if (verifyError || verified.user?.id !== actionRow.user_id)
        throw new AuthError(
          400,
          "This link could not be verified. Request a new email.",
          "LINK_EXPIRED",
        );
      const context = await identity();
      if (actionRow.purpose === "recovery" || actionRow.purpose === "invite") {
        const grant = randomBytes(32).toString("base64url");
        const { error: grantError } = await admin.from("auth_recovery_grants").insert({
          nonce_hash: tokenDigest(grant),
          user_id: context.user.id,
          session_id: context.sessionId,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });
        if (grantError) throw new AuthError(503, "Password setup could not be started.");
        (await cookies()).set("mm_recovery", grant, { ...cookiePolicy(), maxAge: 600 });
        return json({
          redirect: `/reset-password${actionRow.purpose === "invite" ? "?mode=invite" : ""}`,
        });
      }
      const state = await admission(context, request);
      return json({ redirect: destination(state, actionRow.next_path, context) });
    }
    if (action === "google") {
      const input = parse(
        z
          .object({
            next: z.string().optional(),
            remember: z.boolean().default(false),
            admin: z.boolean().default(false),
          })
          .strict(),
        await body(request),
      );
      await limit(request, "oauth", "", 30);
      if (!(await options()).googleEnabled)
        throw new AuthError(
          503,
          "Google sign-in is not available yet. Use email and password.",
          "GOOGLE_UNAVAILABLE",
        );
      await setRemember(input.remember);
      const store = await cookies();
      store.set("mm_oauth_next", safeNext(input.next, input.admin ? "/admin" : "/account"), {
        ...cookiePolicy(),
        maxAge: 600,
      });
      store.set("mm_oauth_admin", input.admin ? "1" : "0", { ...cookiePolicy(), maxAge: 600 });
      const client = await createRequestClient();
      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${appOrigin()}/auth/callback`,
          skipBrowserRedirect: true,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error || !data.url) throw new AuthError(503, "Google sign-in could not be started.");
      return json({ url: data.url });
    }
    if (action === "admit") {
      const input = parse(
        z
          .object({ replace: z.string().uuid().nullable().optional(), next: z.string().optional() })
          .strict(),
        await body(request),
      );
      await limit(request, "admission", "", 30);
      const context = await identity();
      const state = await admission(context, request, input.replace ?? null);
      return json({
        redirect: destination(state, input.next, context),
        admitted: state === "admitted",
      });
    }
    if (action === "logout" || action === "logout-all") {
      const client = await createRequestClient();
      let context;
      if (action === "logout-all") context = await admitted();
      else
        try {
          context = await identity();
        } catch (error) {
          if (error instanceof AuthError && error.status === 503) throw error;
        }
      if (context) {
        const { error } = await context.admin.rpc("auth_revoke_devices", {
          p_user: context.user.id,
          p_current: context.sessionId,
          p_target: null,
          p_all: action === "logout-all",
        });
        if (error) throw new AuthError(503, "Sign-out protection is unavailable. Please retry.");
      }
      await client.auth.signOut({ scope: action === "logout-all" ? "global" : "local" });
      const store = await cookies();
      store.delete("mm_recovery");
      store.delete("mm_remember");
      return json({ redirect: "/login", message: "Signed out." });
    }
    if (action === "password") {
      const input = parse(
        z.object({ password, currentPassword: z.string().max(128).optional() }).strict(),
        await body(request),
      );
      await limit(request, "password-change", "", 10);
      const store = await cookies();
      const recovery = store.get("mm_recovery")?.value;
      const context = recovery ? await identity() : await admitted();
      let grantHash: string | undefined;
      if (recovery) {
        grantHash = tokenDigest(recovery);
        const { data, error } = await context.admin.rpc("auth_claim_recovery", {
          p_hash: grantHash,
          p_user: context.user.id,
          p_session: context.sessionId,
        });
        if (error || !data)
          throw new AuthError(
            403,
            "Your password-reset session expired. Request a new link.",
            "RECOVERY_EXPIRED",
          );
      } else {
        if (!input.currentPassword) throw new AuthError(400, "Enter your current password.");
        const verifier = createClient(
          requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
          requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { error } = await verifier.auth.signInWithPassword({
          email: context.user.email!,
          password: input.currentPassword,
        });
        if (error) throw new AuthError(400, "Your current password was not accepted.");
        await verifier.auth.signOut({ scope: "local" });
      }
      const { error } = await context.client.auth.updateUser({ password: input.password });
      if (error)
        throw new AuthError(
          400,
          "The new password could not be saved. Use a different strong password.",
        );
      const { error: revokeError } = await context.admin.rpc("auth_revoke_devices", {
        p_user: context.user.id,
        p_current: context.sessionId,
        p_target: null,
        p_all: true,
      });
      if (revokeError)
        throw new AuthError(
          503,
          "Password changed, but session cleanup needs a retry. Sign out and contact support.",
        );
      await context.client.auth.signOut({ scope: "global" });
      store.delete("mm_recovery");
      return json({
        redirect: "/login?message=password-updated",
        message: "Password updated. Sign in again on your devices.",
      });
    }
    if (action === "mfa/enroll" || action === "mfa/verify") {
      const context = await admitted();
      if (!isPrivileged(context.profile.role))
        throw new AuthError(403, "Staff access is required.");
      await limit(request, "mfa", context.user.id, 10);
      if (action === "mfa/enroll") {
        const { data: factors, error } = await context.client.auth.mfa.listFactors();
        if (error) throw new AuthError(503, "Authenticator setup is unavailable.");
        if (factors.totp.some((factor) => factor.status === "verified"))
          throw new AuthError(400, "Use your existing authenticator to verify this session.");
        for (const factor of factors.all.filter((factor) => factor.status === "unverified"))
          await context.client.auth.mfa.unenroll({ factorId: factor.id });
        const { data, error: enrollError } = await context.client.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Market Method staff",
        });
        if (enrollError || !data)
          throw new AuthError(503, "Authenticator setup could not be started.");
        return json({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      }
      const input = parse(
        z
          .object({
            factorId: z.string().uuid(),
            code: z.string().regex(/^\d{6}$/, "Enter a six-digit code."),
          })
          .strict(),
        await body(request),
      );
      const { error } = await context.client.auth.mfa.challengeAndVerify({
        factorId: input.factorId,
        code: input.code,
      });
      if (error)
        throw new AuthError(
          400,
          "That code was not accepted. Try the current code in your authenticator.",
        );
      await audit(context, "mfa_verified", context.user.id);
      return json({ message: "Authenticator verified.", redirect: "/admin" });
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return failure(error);
  }
}

export async function oauthCallback(request: Request) {
  const store = await cookies();
  const next = safeNext(store.get("mm_oauth_next")?.value);
  const adminLogin = store.get("mm_oauth_admin")?.value === "1";
  try {
    const code = new URL(request.url).searchParams.get("code");
    if (!code) throw new AuthError(400, "Missing callback.");
    const client = await createRequestClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw new AuthError(400, "Sign-in callback could not be verified.");
    const context = await identity();
    if (adminLogin && !isPrivileged(context.profile.role)) {
      await client.auth.signOut({ scope: "local" });
      throw new AuthError(403, "Staff access required.");
    }
    const state = await admission(context, request);
    store.delete("mm_oauth_next");
    store.delete("mm_oauth_admin");
    return Response.redirect(new URL(destination(state, next, context), appOrigin()), 303);
  } catch {
    return Response.redirect(new URL("/login?error=oauth", appOrigin()), 303);
  }
}

export async function adminStaffRequest(request: Request) {
  try {
    if (request.method !== "GET") sameOrigin(request);
    const context = await privileged(true);
    if (request.method === "GET") {
      const { data, error } = await context.admin.rpc("auth_list_staff");
      if (error) throw new AuthError(503, "Staff accounts could not be loaded.");
      return json({ staff: data });
    }
    await limit(request, "staff-management", context.user.id, 10, 3600);
    if (request.method === "POST") {
      const input = parse(
        z.object({ email, name: z.string().trim().min(1).max(80) }).strict(),
        await body(request),
      );
      const { data: exists, error: lookupError } = await context.admin.rpc("auth_user_exists", {
        p_email: input.email,
      });
      if (lookupError) throw new AuthError(503, "Invitation lookup is unavailable.");
      if (exists)
        throw new AuthError(
          400,
          "An account already exists for this address; it has not been promoted.",
        );
      const { data, error } = await context.admin.auth.admin.generateLink({
        type: "invite",
        email: input.email,
        options: { data: { full_name: input.name } },
      });
      if (error || !data.user || !data.properties?.hashed_token)
        throw new AuthError(
          400,
          "This address could not be invited. Existing accounts are not automatically promoted.",
        );
      const { error: roleError } = await context.admin
        .from("profiles")
        .update({ role: "support", full_name: input.name })
        .eq("id", data.user.id)
        .eq("role", "student");
      if (roleError) throw new AuthError(503, "Staff role could not be assigned.");
      await deliverAuthEmail({
        userId: data.user.id,
        email: input.email,
        providerHash: data.properties.hashed_token,
        purpose: "invite",
      });
      await audit(context, "staff_invited", data.user.id);
      return json({ message: "Support invitation sent." }, 201);
    }
    if (request.method === "DELETE") {
      const input = parse(z.object({ userId: z.string().uuid() }).strict(), await body(request));
      if (input.userId === context.user.id)
        throw new AuthError(400, "You cannot remove your own access.");
      const { data, error } = await context.admin
        .from("profiles")
        .update({ role: "student" })
        .eq("id", input.userId)
        .eq("role", "support")
        .select("id")
        .maybeSingle();
      if (error || !data) throw new AuthError(400, "Support account not found.");
      const { error: revokeError } = await context.admin.rpc("auth_revoke_devices", {
        p_user: input.userId,
        p_current: context.sessionId,
        p_target: null,
        p_all: true,
      });
      if (revokeError)
        throw new AuthError(
          503,
          "Support access was removed, but ending all account sessions failed. Retry the session revocation from the operator console.",
        );
      await audit(context, "staff_access_removed", input.userId);
      return json({ message: "Support access removed; existing sessions ended." });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    return failure(error);
  }
}
