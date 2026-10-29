import "./load-env.mjs";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { verifyStagingTarget } from "./database-target.mjs";

if (process.env.PROJECT_STAGE !== "staging") throw new Error("Staging required.");
const db = new pg.Client(verifyStagingTarget());
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const contexts = [];
const origin = "http://127.0.0.1:3000";
let userId;
let step = "initialisation";
const checks = [];
const issues = [];
const errors = [];
mkdirSync(".impeccable/review", { recursive: true });
async function check(page, route, theme, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
    `${route} overflow`,
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  issues.push(
    ...result.violations.map((item) => ({
      route,
      theme,
      width,
      id: item.id,
      targets: item.nodes.map((node) => node.target),
    })),
  );
  checks.push({ route, theme, width });
}
try {
  await db.connect();
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  contexts.push(ctx);
  const page = await ctx.newPage();
  page.on("pageerror", () => errors.push("Browser runtime exception"));
  for (const theme of ["dark", "light"]) {
    await ctx.addInitScript((value) => localStorage.setItem("market-method-theme", value), theme);
    for (const width of [1440, 390, 360]) {
      for (const route of [
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/auth/confirm",
        "/admin/login",
      ]) {
        step = `${theme} ${width} ${route}`;
        await check(page, route, theme, width);
      }
    }
  }
  await page.goto(`${origin}/login`);
  await page.screenshot({ path: ".impeccable/review/login-mobile.png", fullPage: true });
  step = "disposable account UI";
  const email = `phase2-ui-${randomUUID()}@example.invalid`;
  const password = `Aa9-${randomBytes(20).toString("hex")}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Preview learner" },
  });
  if (created.error || !created.data.user) throw new Error("Fixture failed");
  userId = created.data.user.id;
  for (let device = 0; device < 3; device++) {
    const deviceCtx = await browser.newContext({ reducedMotion: "reduce" });
    contexts.push(deviceCtx);
    const login = await deviceCtx.request.post(`${origin}/api/auth/login`, {
      headers: { Origin: origin },
      data: { email, password, remember: false },
    });
    assert.equal(login.status(), 200);
    if (device === 1) continue;
    const authenticated = await deviceCtx.newPage();
    authenticated.on("pageerror", () => errors.push("Browser runtime exception"));
    for (const theme of ["light", "dark"]) {
      await deviceCtx.addInitScript(
        (value) => localStorage.setItem("market-method-theme", value),
        theme,
      );
      for (const width of [1440, 390, 360]) {
        const route = device === 0 ? "/account" : "/auth/devices";
        step = `${theme} ${width} ${route}`;
        await check(authenticated, route, theme, width);
      }
    }
    if (device === 2) {
      await authenticated.screenshot({
        path: ".impeccable/review/devices-mobile.png",
        fullPage: true,
      });
      assert.equal(
        await authenticated.getByRole("button", { name: /Sign out & continue/i }).count(),
        2,
      );
    }
  }
  writeFileSync(
    ".impeccable/review/auth-ui-verification.json",
    JSON.stringify({ at: new Date().toISOString(), checks, issues, errors }, null, 2),
  );
  assert.equal(
    issues.length,
    0,
    `${issues.length} accessibility violations; see local safe report`,
  );
  assert.equal(errors.length, 0, "No browser runtime exceptions");
  console.log(
    `PASS ${checks.length} auth/account/device viewport and theme combinations, no horizontal overflow, no WCAG A/AA Axe violations or runtime exceptions.`,
  );
} catch {
  console.error(
    `FAIL ${step}; sensitive error details withheld. Inspect local accessibility report if present.`,
  );
  process.exitCode = 1;
} finally {
  writeFileSync(
    ".impeccable/review/auth-ui-verification.json",
    JSON.stringify({ at: new Date().toISOString(), checks, issues, errors }, null, 2),
  );
  if (userId) {
    try {
      await db.query("delete from public.audit_log where actor_id=$1", [userId]);
      await db.query("delete from public.device_sessions where user_id=$1", [userId]);
      const removed = await admin.auth.admin.deleteUser(userId);
      if (removed.error) throw new Error("Cleanup failed");
      console.log("Disposable UI fixture removed.");
    } catch {
      console.error("Disposable UI cleanup requires review.");
      process.exitCode = 1;
    }
  }
  await Promise.all(contexts.map((ctx) => ctx.close()));
  await browser.close();
  await db.end().catch(() => {});
}
