import "./load-env.mjs";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import * as OTPAuth from "otpauth";
import { verifyStagingTarget } from "./database-target.mjs";
import { sealToken, tokenDigest } from "../auth/crypto.ts";

const origin = "http://127.0.0.1:3000";
if (process.env.PROJECT_STAGE !== "staging")
  throw new Error("Staging is required for disposable auth tests.");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const db = new pg.Client(verifyStagingTarget());
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const ids = [];
const contexts = [];
const checks = [];
const password = `Test-Aa9-${randomBytes(16).toString("hex")}`;
const newPassword = `Next-Aa9-${randomBytes(16).toString("hex")}`;
const recoveryPassword = `Reset-Aa9-${randomBytes(16).toString("hex")}`;
let step = "connect staging";
let courseId;
const pass = (label) => {
  checks.push(label);
  console.log(`PASS ${label}`);
};
function status(response, expected, label) {
  assert.equal(response.status(), expected, label);
}
async function fixture(role = "student") {
  const email = `phase2-${randomUUID()}@example.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Phase 2 ${role}` },
  });
  if (error || !data.user) throw new Error("Disposable user creation failed");
  ids.push(data.user.id);
  if (role !== "student") {
    const { error: roleError } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", data.user.id);
    if (roleError) throw new Error("Fixture role setup failed");
  }
  return { id: data.user.id, email, password };
}
async function context(userAgent = "Mozilla/5.0 (Windows NT 10.0) Chrome/140") {
  const result = await browser.newContext({
    baseURL: origin,
    userAgent,
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  contexts.push(result);
  return result;
}
async function post(ctx, path, payload, headers = {}) {
  return ctx.request.post(path, { data: payload, headers: { Origin: origin, ...headers } });
}
async function login(ctx, user, remember = false, next = "/account") {
  const response = await post(ctx, "/api/auth/login", {
    email: user.email,
    password: user.password,
    remember,
    next,
  });
  status(response, 200, "Login must succeed");
  return response.json();
}
async function jwt(ctx) {
  const list = (await ctx.cookies())
    .filter((cookie) => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name))
    .sort(
      (a, b) =>
        (Number(a.name.match(/\.(\d+)$/)?.[1]) || 0) - (Number(b.name.match(/\.(\d+)$/)?.[1]) || 0),
    );
  const value = list.map((cookie) => cookie.value).join("");
  if (!value.startsWith("base64-")) throw new Error("Unexpected auth cookie encoding");
  return JSON.parse(Buffer.from(value.slice(7), "base64url").toString()).access_token;
}
async function privateOrders(ctx) {
  const token = await jwt(ctx);
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/orders?select=id`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  assert.equal(response.status, 200, "Direct authenticated REST request");
  return (await response.json()).length;
}
async function action(user, purpose, providerHash, expired = false) {
  const nonce = randomBytes(32).toString("base64url");
  const { error } = await admin.from("auth_email_actions").insert({
    nonce_hash: tokenDigest(nonce),
    user_id: user.id,
    token_ciphertext: sealToken(providerHash, process.env.SUPABASE_SERVICE_ROLE_KEY),
    purpose,
    next_path: "/account",
    expires_at: new Date(Date.now() + (expired ? -60000 : 1800000)).toISOString(),
  });
  if (error) throw new Error("Email action fixture failed");
  return nonce;
}

try {
  await db.connect();
  mkdirSync(".impeccable/review", { recursive: true });
  const student = await fixture();
  const owner = await fixture("admin");
  const support = await fixture("support");
  const a = await context();
  const b = await context("Mozilla/5.0 (Linux) Firefox/140");
  const c = await context("Mozilla/5.0 (Android) Chrome/140");
  step = "anonymous protection and origin rejection";
  status(await a.request.get("/api/auth/me"), 401, "Anonymous account access");
  status(
    await post(
      a,
      "/api/auth/login",
      { email: student.email, password },
      { Origin: "https://evil.example" },
    ),
    403,
    "Cross-origin login",
  );
  pass(step);
  step = "real browser password login and secure cookie policy";
  const page = await a.newPage();
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(student.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/account");
  await page.getByRole("heading", { name: "Profile details" }).waitFor();
  status(await a.request.get("/api/auth/me"), 200, "Admitted account");
  const authCookies = (await a.cookies()).filter((cookie) => cookie.name.includes("auth-token"));
  assert.ok(authCookies.length > 0);
  assert.ok(
    authCookies.every(
      (cookie) => cookie.httpOnly && cookie.sameSite === "Lax" && cookie.expires === -1,
    ),
    "Session cookies must be HttpOnly/Lax without persistence by default",
  );
  await page.screenshot({ path: ".impeccable/review/account-desktop.png" });
  pass(step);
  step = "profile editing and role escalation rejection";
  await page.getByLabel("Full name", { exact: true }).fill("Updated Test Student");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Profile updated." }).waitFor();
  const escalation = await a.request.patch("/api/auth/profile", {
    data: { name: "Attack", role: "admin" },
    headers: { Origin: origin },
  });
  status(escalation, 400, "Role fields must be rejected");
  assert.equal((await (await a.request.get("/api/auth/me")).json()).user.role, "student");
  status(await a.request.get("/api/admin/staff"), 403, "Student admin API access");
  pass(step);
  step = "two-device admission, third-device challenge and direct REST isolation";
  await login(b, student, true);
  const persistent = (await b.cookies()).filter((cookie) => cookie.name.includes("auth-token"));
  assert.ok(
    persistent.every((cookie) => cookie.expires > Date.now() / 1000 + 20 * 86400),
    "Remember-me cookies persist",
  );
  courseId = randomUUID();
  await db.query(
    "insert into public.courses(id,slug,title,price_paise,status) values($1,$2,'Disposable auth test',100,'draft')",
    [courseId, `auth-test-${randomUUID()}`],
  );
  await db.query(
    "insert into public.orders(user_id,course_id,base_paise,total_paise) values($1,$2,100,100)",
    [student.id, courseId],
  );
  assert.equal(await privateOrders(a), 1, "Admitted owner must read the fixture order");
  const third = await login(c, student);
  assert.match(third.redirect, /^\/auth\/devices/);
  status(await c.request.get("/api/auth/me"), 409, "Pending device must not access account");
  assert.equal(await privateOrders(c), 0, "Pending device must not bypass through REST");
  const challenge = await c.newPage();
  await challenge.goto(third.redirect);
  await challenge
    .locator(".device-row")
    .filter({ hasText: "Chrome on Windows" })
    .getByRole("button", { name: /Sign out & continue/ })
    .click();
  await challenge.waitForURL("**/account");
  status(await a.request.get("/api/auth/me"), 401, "Replaced device must lose access immediately");
  status(await a.request.get("/api/auth/devices"), 401, "Replaced device must not manage devices");
  assert.equal(await privateOrders(a), 0, "Revoked REST token must lose data access");
  status(await c.request.get("/api/auth/me"), 200, "Replacement admitted");
  pass(step);
  step = "logout all and password-change reauthentication";
  status(await post(c, "/api/auth/logout-all", {}), 200, "Global logout");
  status(await b.request.get("/api/auth/me"), 401, "Other device revoked by global logout");
  const d = await context();
  await login(d, student);
  status(
    await post(d, "/api/auth/password", { currentPassword: "wrong", password: newPassword }),
    400,
    "Current password required",
  );
  status(
    await post(d, "/api/auth/password", { currentPassword: password, password: newPassword }),
    200,
    "Password changed",
  );
  status(await d.request.get("/api/auth/me"), 401, "Password change must end old session");
  status(
    await post(d, "/api/auth/login", { email: student.email, password, remember: false }),
    401,
    "Old password rejected",
  );
  student.password = newPassword;
  await login(d, student);
  pass(step);
  step = "concurrent logins cannot exceed the configured device cap";
  const race = await fixture();
  const raceContexts = await Promise.all([context(), context(), context()]);
  const responses = await Promise.all(raceContexts.map((ctx) => login(ctx, race)));
  assert.equal(responses.filter((result) => result.redirect.startsWith("/auth/devices")).length, 1);
  const active = await db.query(
    "select count(*)::int as n from public.device_sessions where user_id=$1 and admitted_at is not null and revoked_at is null and expires_at>now()",
    [race.id],
  );
  assert.equal(active.rows[0].n, 2);
  pass(step);
  step = "real provider signup verification, scanner-safe GET, expiry and single-use links";
  const signupEmail = `phase2-${randomUUID()}@example.invalid`;
  const generated = await admin.auth.admin.generateLink({
    type: "signup",
    email: signupEmail,
    password,
  });
  if (generated.error || !generated.data.user) throw new Error("Provider signup generation failed");
  const verifyUser = generated.data.user;
  ids.push(verifyUser.id);
  const token = await action(verifyUser, "signup", generated.data.properties.hashed_token);
  const verifyContext = await context();
  const verificationPage = await verifyContext.newPage();
  await verificationPage.goto(`/auth/confirm?token=${encodeURIComponent(token)}`);
  const pending = await db.query(
    "select consumed_at from public.auth_email_actions where nonce_hash=$1",
    [tokenDigest(token)],
  );
  assert.equal(pending.rows[0].consumed_at, null, "GET must not consume email links");
  await verificationPage.getByRole("button", { name: "Continue securely" }).click();
  await verificationPage.waitForURL("**/account");
  status(await verifyContext.request.get("/api/auth/me"), 200, "Verified account admitted");
  status(await post(verifyContext, "/api/auth/confirm", { token }), 400, "Link replay rejected");
  const expired = await action(verifyUser, "signup", "expired-test-verifier", true);
  status(
    await post(verifyContext, "/api/auth/confirm", { token: expired }),
    400,
    "Expired link rejected",
  );
  pass(step);
  step = "real provider recovery token and password reset";
  const recovery = await admin.auth.admin.generateLink({ type: "recovery", email: student.email });
  if (recovery.error) throw new Error("Provider recovery token generation failed");
  const resetToken = await action(student, "recovery", recovery.data.properties.hashed_token);
  const resetContext = await context();
  status(
    await post(resetContext, "/api/auth/confirm", { token: resetToken }),
    200,
    "Recovery confirmed",
  );
  status(
    await resetContext.request.get("/api/auth/me"),
    401,
    "Recovery grant alone does not grant account access",
  );
  status(
    await post(resetContext, "/api/auth/password", { password: recoveryPassword }),
    200,
    "Recovery password saved",
  );
  student.password = recoveryPassword;
  await login(resetContext, student);
  status(await d.request.get("/api/auth/me"), 401, "Recovery revokes other account sessions");
  pass(step);
  step = "privileged MFA gate, real TOTP enrollment and support role restrictions";
  const adminContext = await context();
  await login(adminContext, owner);
  const denied = await adminContext.request.get("/api/admin/staff");
  status(denied, 403, "Admin must verify MFA");
  assert.equal((await denied.json()).code, "MFA_REQUIRED");
  const enroll = await post(adminContext, "/api/auth/mfa/enroll", {});
  status(enroll, 200, "MFA enrollment");
  const factor = await enroll.json();
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(factor.secret),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  status(
    await post(adminContext, "/api/auth/mfa/verify", {
      factorId: factor.factorId,
      code: totp.generate(),
    }),
    200,
    "TOTP verification",
  );
  status(await adminContext.request.get("/api/admin/staff"), 200, "MFA-approved admin access");
  const supportContext = await context();
  await login(supportContext, support);
  status(await supportContext.request.get("/api/admin/staff"), 403, "Support cannot manage staff");
  status(
    await post(adminContext, "/api/admin/staff", {
      email: student.email,
      name: "Existing student",
    }),
    400,
    "Existing users are not promoted by invite",
  );
  const removed = await adminContext.request.delete("/api/admin/staff", {
    headers: { Origin: origin },
    data: { userId: support.id },
  });
  status(removed, 200, "Support access removed");
  status(await supportContext.request.get("/api/auth/me"), 401, "Removed staff sessions revoked");
  pass(step);
  step = "durable login throttling";
  const throttle = await fixture();
  const rateContext = await context();
  let last;
  for (let count = 0; count < 11; count++)
    last = await post(rateContext, "/api/auth/login", {
      email: throttle.email,
      password: "wrong-password",
      remember: false,
    });
  status(last, 429, "Excess login attempts must be throttled");
  pass(step);
  step = "Google authorization configuration";
  const googleContext = await context();
  const providerOptions = await (await googleContext.request.get("/api/auth/options")).json();
  if (providerOptions.googleEnabled) {
    const begin = await post(googleContext, "/api/auth/google", {
      next: "/courses/market-foundations",
      remember: false,
    });
    status(begin, 200, "Google authorization begins");
    const target = new URL((await begin.json()).url);
    assert.equal(target.origin, new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin);
    assert.equal(target.searchParams.get("provider"), "google");
    assert.ok(target.searchParams.get("code_challenge"), "OAuth must use PKCE");
    pass("Google PKCE authorization initiation; user consent round-trip remains manual");
  } else pass("Google unavailable state exposed honestly; provider setup remains external");
  writeFileSync(
    ".impeccable/review/auth-verification.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        checks,
        disposableUsers: ids.length,
        notes: [
          "Email token flows use real Supabase-generated verifiers injected into the app's private email-action store; inbox delivery is tested separately.",
          "Real Google account consent is not automated.",
        ],
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    `FAIL ${step}. Sensitive error details suppressed; inspect implementation/server status without printing credentials.`,
  );
  process.exitCode = 1;
} finally {
  try {
    if (ids.length) {
      await db.query("begin");
      await db.query("delete from public.audit_log where actor_id=any($1::uuid[])", [ids]);
      await db.query("delete from public.device_sessions where user_id=any($1::uuid[])", [ids]);
      await db.query("delete from public.orders where user_id=any($1::uuid[])", [ids]);
      if (courseId) await db.query("delete from public.courses where id=$1", [courseId]);
      await db.query("commit");
      for (const id of ids) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw new Error("Fixture user cleanup failed");
      }
    }
    console.log("Disposable staging account/data cleanup complete.");
  } catch {
    console.error("Fixture cleanup needs operator review; no identifiers or secrets printed.");
    process.exitCode = 1;
  }
  await Promise.all(contexts.map((ctx) => ctx.close().catch(() => {})));
  await browser.close();
  await db.end().catch(() => {});
}
