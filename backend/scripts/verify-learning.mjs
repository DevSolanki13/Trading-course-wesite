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
const origin = "http://127.0.0.1:3000";
const apiOnly = process.argv.includes("--api-only");
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
const userIds = [];
const contexts = [];
const checks = [];
const limitations = [];
let step = "connect";
let courseId;
let moduleId;
let paidLesson;
let previewLesson;
let draftLesson;
let playbackConfirmed = false;
const password = `Aa9-${randomBytes(20).toString("hex")}`;
const pass = (label) => {
  checks.push(label);
  console.log(`PASS ${label}`);
};
async function user() {
  const email = `phase4-${randomUUID()}@example.invalid`;
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Staging learner" },
  });
  if (result.error || !result.data.user) throw new Error("Fixture failed");
  userIds.push(result.data.user.id);
  return { id: result.data.user.id, email };
}
async function context() {
  const ctx = await browser.newContext({
    baseURL: origin,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  contexts.push(ctx);
  return ctx;
}
async function post(ctx, action, payload) {
  return ctx.request.post(`/api/learning/${action}`, {
    headers: { Origin: origin },
    data: payload,
  });
}
async function signIn(ctx, user) {
  const r = await ctx.request.post("/api/auth/login", {
    headers: { Origin: origin },
    data: { email: user.email, password, remember: false },
  });
  assert.equal(r.status(), 200);
}
async function insert(table, values) {
  const result = await admin.from(table).insert(values).select().single();
  if (result.error || !result.data) throw new Error("Fixture insert failed");
  return result.data;
}
mkdirSync(".impeccable/review", { recursive: true });
try {
  await db.connect();
  const metadata = await fetch(
    `https://dev.vdocipher.com/api/videos/${encodeURIComponent(process.env.VDOCIPHER_TEST_VIDEO_ID)}`,
    {
      headers: { Authorization: `Apisecret ${process.env.VDOCIPHER_API_SECRET}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  assert.equal(metadata.status, 200);
  const video = await metadata.json();
  assert.equal(video.status, "ready");
  const duration = Math.ceil(video.length);
  assert.ok(duration > 0);
  const owner = await user();
  const outsider = await user();
  const guest = await context();
  const learner = await context();
  const other = await context();
  await signIn(learner, owner);
  await signIn(other, outsider);
  const slug = `phase4-${randomUUID()}`;
  courseId = (
    await insert("courses", {
      slug,
      title: "Phase 4 verification classroom",
      description: "Disposable staging course; removed after verification.",
      price_paise: 100,
      status: "published",
    })
  ).id;
  moduleId = (
    await insert("modules", {
      course_id: courseId,
      title: "A structured starting point",
      position: 0,
    })
  ).id;
  paidLesson = (
    await insert("lessons", {
      module_id: moduleId,
      title: "Protected lesson",
      position: 0,
      duration_seconds: duration,
      published: true,
    })
  ).id;
  previewLesson = (
    await insert("lessons", {
      module_id: moduleId,
      title: "Public preview lesson",
      position: 1,
      duration_seconds: duration,
      is_preview: true,
      published: true,
    })
  ).id;
  draftLesson = (
    await insert("lessons", {
      module_id: moduleId,
      title: "Unpublished lesson",
      position: 2,
      duration_seconds: duration,
      published: false,
    })
  ).id;
  for (const lesson_id of [paidLesson, previewLesson, draftLesson]) {
    await insert("lesson_assets", {
      lesson_id,
      provider_video_id: process.env.VDOCIPHER_TEST_VIDEO_ID,
      notes: "Keep a clear journal. This is an authorised staging verification note.",
    });
    await insert("lesson_resources", {
      lesson_id,
      title: "Practice worksheet",
      content: "1. Write your observation.\n2. Record the risk.\n3. Review the decision.",
      position: 0,
    });
  }
  await insert("enrollments", { user_id: owner.id, course_id: courseId, source: "manual" });
  step = "public/paid authorisation";
  assert.equal((await guest.request.get("/api/learning/library")).status(), 401);
  assert.equal((await post(guest, "playback", { lessonId: paidLesson })).status(), 401);
  assert.equal((await post(other, "playback", { lessonId: paidLesson })).status(), 403);
  assert.equal((await post(learner, "playback", { lessonId: draftLesson })).status(), 404);
  assert.equal((await other.request.get(`/api/learning/lesson?id=${paidLesson}`)).status(), 403);
  const curriculum = await (await guest.request.get(`/api/learning/course?slug=${slug}`)).json();
  assert.equal(curriculum.course.modules[0].lessons.length, 2);
  assert.ok(!JSON.stringify(curriculum).includes(process.env.VDOCIPHER_TEST_VIDEO_ID));
  assert.ok(!JSON.stringify(curriculum).includes("authorised staging verification note"));
  const preview = await post(guest, "playback", { lessonId: previewLesson });
  assert.equal(preview.status(), 200);
  assert.equal((await preview.json()).leaseId, null);
  pass("anonymous published preview, private notes/video denial and draft/provider-ID isolation");
  step = "real provider token and watch ledger";
  const response = await post(learner, "playback", { lessonId: paidLesson });
  assert.equal(response.status(), 200);
  const token = await response.json();
  assert.ok(token.otp && token.playbackInfo && token.leaseId);
  const beat = (sequence, position, seeking = false) =>
    post(learner, "heartbeat", {
      leaseId: token.leaseId,
      sequence,
      position,
      seeking,
      playing: true,
      rate: 1,
    });
  assert.equal((await beat(1, 0)).status(), 200);
  await new Promise((r) => setTimeout(r, 1200));
  const watched = await (await beat(2, 1)).json();
  assert.equal(Number(watched.watchedSeconds), 1);
  assert.equal((await beat(2, 1)).status(), 409);
  const seek = await (await beat(3, 80, true)).json();
  assert.equal(Number(seek.watchedSeconds), 1);
  assert.equal(
    (await post(learner, "complete", { lessonId: paidLesson, completed: true })).status(),
    200,
  );
  const progress = await db.query(
    "select position_ms,completed from lesson_progress where user_id=$1 and lesson_id=$2",
    [owner.id, paidLesson],
  );
  assert.equal(progress.rows[0].position_ms, 80000);
  assert.equal(progress.rows[0].completed, true);
  const restarted = await post(learner, "playback", { lessonId: paidLesson });
  assert.equal((await restarted.json()).position, 80);
  assert.equal((await beat(4, 80)).status(), 409);
  pass(
    "real VdoCipher credentials, server resume/completion, bounded heartbeat and replaced-player rejection",
  );
  step = "purchase entitlement and community boundaries";
  const order = await insert("orders", {
    user_id: outsider.id,
    course_id: courseId,
    status: "pending",
    base_paise: 100,
    total_paise: 100,
    course_snapshot: { title: "Phase 4 verification classroom" },
  });
  await insert("enrollments", {
    user_id: outsider.id,
    course_id: courseId,
    source: "purchase",
    order_id: order.id,
  });
  assert.equal((await post(other, "playback", { lessonId: paidLesson })).status(), 403);
  const paid = await admin
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", order.id);
  assert.equal(paid.error, null);
  assert.equal((await post(other, "playback", { lessonId: paidLesson })).status(), 200);
  const library = await (await other.request.get("/api/learning/library")).json();
  assert.equal(library.community.eligible, true);
  assert.equal(library.orders[0].refund.eligible, false);
  assert.match(library.orders[0].refund.reason, /snapshot/);
  const refunded = await admin.from("orders").update({ status: "refunded" }).eq("id", order.id);
  assert.equal(refunded.error, null);
  assert.equal((await post(other, "playback", { lessonId: paidLesson })).status(), 403);
  pass("pending/refunded purchase denial, manual access and honest missing refund snapshot state");
  if (!apiOnly) {
    step = "responsive library/classroom and accessibility";
    const page = await learner.newPage();
    const audits = [];
    for (const theme of ["dark", "light"]) {
      await learner.addInitScript((t) => localStorage.setItem("market-method-theme", t), theme);
      for (const width of [1440, 390, 360]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const route of ["/learn", `/learn/${slug}?lesson=${paidLesson}`]) {
          await page.goto(route, { waitUntil: "networkidle" });
          await page.waitForSelector(
            route === "/learn" ? ".learning-course-card" : ".learning-notes",
          );
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
            false,
          );
          const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          audits.push({
            theme,
            width,
            route: route === "/learn" ? "library" : "classroom",
            violations: axe.violations.map((v) => ({
              id: v.id,
              targets: v.nodes.map((n) => n.target),
            })),
          });
        }
      }
    }
    writeFileSync(".impeccable/review/learning-a11y.json", JSON.stringify(audits, null, 2));
    assert.equal(
      audits.reduce((n, a) => n + a.violations.length, 0),
      0,
      "Axe issues in safe local report",
    );
    await page.getByRole("button", { name: "Lessons", exact: true }).click();
    assert.equal(await page.locator("#lesson-sidebar").isVisible(), true);
    await page.getByRole("button", { name: "Close lesson list" }).click();
    await page.screenshot({ path: ".impeccable/review/classroom-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: ".impeccable/review/classroom-desktop.png", fullPage: true });
    pass(
      "12 library/classroom theme/viewport combinations, mobile curriculum controls and Axe A/AA",
    );
    step = "player SDK contract simulation and server progress persistence";
    // Test-only browser interception: exercise our SDK binding without pretending to verify DRM.
    const simulation = await learner.newPage();
    await simulation.route("https://player.vdocipher.com/v2/api.js", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `
    const instances=new WeakMap();window.VdoPlayer={getInstance(frame){if(instances.has(frame))return instances.get(frame);const events=new Map();let position=0;const video={paused:true,seeking:false,playbackRate:1,duration:168,disablePictureInPicture:false,
      get currentTime(){return position},set currentTime(n){video.seeking=true;position=n;fire('seeking');video.seeking=false;fire('seeked')},
      play(){video.paused=false;fire('play');return Promise.resolve()},pause(){video.paused=true;fire('pause');return Promise.resolve()},
      addEventListener(n,fn){if(!events.has(n))events.set(n,new Set());events.get(n).add(fn)},removeEventListener(n,fn){events.get(n)?.delete(fn)},emit:fire};
      function fire(n){for(const fn of events.get(n)||[])fn()}setInterval(()=>{if(!video.paused&&!video.seeking)position+=video.playbackRate},1000);
      const instance={video};instances.set(frame,instance);setTimeout(()=>fire('loadedmetadata'),50);return instance;}};`,
      }),
    );
    await simulation.route(/https:\/\/player\.vdocipher\.com\/v2\/\?/, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><html><body>Test-only player contract fixture</body></html>",
      }),
    );
    await simulation.goto(`${origin}/learn/${slug}?lesson=${paidLesson}`, {
      waitUntil: "networkidle",
    });
    await simulation.getByRole("button", { name: "Start lesson", exact: true }).click();
    await simulation.waitForFunction(() => {
      const frame = document.querySelector(".learning-video iframe");
      return !!(frame && window.VdoPlayer);
    });
    await simulation.waitForTimeout(200);
    await simulation.evaluate(async () => {
      await window.VdoPlayer.getInstance(
        document.querySelector(".learning-video iframe"),
      ).video.play();
    });
    await simulation.waitForTimeout(12000);
    const clientProgress = await db.query(
      "select position_ms,(select sum(upper(r)-lower(r)) from unnest(watched) r) as watched_ms from lesson_progress where user_id=$1 and lesson_id=$2",
      [owner.id, paidLesson],
    );
    assert.ok(clientProgress.rows[0].position_ms > 80000);
    assert.ok(Number(clientProgress.rows[0].watched_ms) > 1000);
    await simulation.getByLabel("Playback speed").selectOption("1.5");
    await simulation.getByLabel("Auto-play next lesson").check();
    await simulation.evaluate(() =>
      window.VdoPlayer.getInstance(document.querySelector(".learning-video iframe")).video.emit(
        "ended",
      ),
    );
    await simulation.getByRole("heading", { name: "Public preview lesson", exact: true }).waitFor();
    await simulation.locator(".learning-video iframe").waitFor();
    await simulation.close();
    pass(
      "SDK contract simulation: client heartbeat saves progress, speed control and auto-next load the next lesson (not a DRM playback claim)",
    );
    step = "actual protected browser playback";
    await page.getByRole("button", { name: "Start lesson", exact: true }).click();
    await page.locator(".learning-video iframe").waitFor();
    try {
      await page.waitForFunction(
        () => {
          const frame = document.querySelector(".learning-video iframe");
          return !!(frame && window.VdoPlayer);
        },
        {},
        { timeout: 15000 },
      );
      await page.evaluate(async () => {
        const player = window.VdoPlayer.getInstance(
          document.querySelector(".learning-video iframe"),
        );
        await Promise.race([
          player.video.play(),
          new Promise((_, reject) => setTimeout(reject, 10000)),
        ]);
      });
      await page.waitForFunction(
        () => {
          const player = window.VdoPlayer.getInstance(
            document.querySelector(".learning-video iframe"),
          );
          return !player.video.paused && player.video.currentTime > 2;
        },
        {},
        { timeout: 25000 },
      );
      playbackConfirmed = true;
      await page.screenshot({ path: ".impeccable/review/protected-playback.png" });
      pass("actual browser playback advances through the VdoCipher player");
    } catch {
      limitations.push(
        "Actual DRM playback was not confirmed by this browser; platform/provider acceptance needs review.",
      );
      console.log("PARTIAL actual DRM playback not confirmed; no token/error payload printed.");
      process.exitCode = 2;
    }
  } else {
    limitations.push("Focused API-only run; DRM and browser UI are covered separately.");
  }
  step = "immediate enrollment/session revocation";
  const revoked = await admin
    .from("enrollments")
    .update({ active: false, revoked_at: new Date().toISOString() })
    .eq("user_id", owner.id)
    .eq("course_id", courseId);
  assert.equal(revoked.error, null);
  assert.equal((await learner.request.get(`/api/learning/lesson?id=${paidLesson}`)).status(), 403);
  assert.equal((await post(learner, "playback", { lessonId: paidLesson })).status(), 403);
  await learner.request.post("/api/auth/logout-all", { headers: { Origin: origin }, data: {} });
  assert.equal((await learner.request.get("/api/learning/library")).status(), 401);
  pass("revocation immediately blocks notes, token refresh and private learning APIs");
} catch {
  console.error(`FAIL ${step}; sensitive provider/account details withheld.`);
  process.exitCode = 1;
} finally {
  writeFileSync(
    apiOnly
      ? ".impeccable/review/learning-api-verification.json"
      : ".impeccable/review/learning-verification.json",
    JSON.stringify(
      { at: new Date().toISOString(), checks, limitations, playbackConfirmed },
      null,
      2,
    ),
  );
  try {
    if (courseId) {
      await db.query("begin");
      await db.query("delete from public.learning_playbacks where user_id=any($1::uuid[])", [
        userIds,
      ]);
      await db.query("delete from public.lesson_progress where user_id=any($1::uuid[])", [userIds]);
      await db.query("delete from public.enrollments where course_id=$1", [courseId]);
      await db.query("delete from public.orders where course_id=$1", [courseId]);
      await db.query(
        "delete from public.lesson_resources where lesson_id in(select id from public.lessons where module_id=$1)",
        [moduleId],
      );
      await db.query(
        "delete from public.lesson_assets where lesson_id in(select id from public.lessons where module_id=$1)",
        [moduleId],
      );
      await db.query("delete from public.lessons where module_id=$1", [moduleId]);
      await db.query("delete from public.modules where id=$1", [moduleId]);
      await db.query("delete from public.courses where id=$1", [courseId]);
      await db.query("commit");
    }
    if (userIds.length) {
      await db.query("delete from public.audit_log where actor_id=any($1::uuid[])", [userIds]);
      await db.query("delete from public.device_sessions where user_id=any($1::uuid[])", [userIds]);
      for (const id of userIds) {
        const removed = await admin.auth.admin.deleteUser(id);
        if (removed.error) throw new Error("User cleanup failed");
      }
    }
    console.log("Disposable learning fixtures cleaned up.");
  } catch {
    console.error("Fixture cleanup needs operator review.");
    process.exitCode = 1;
  }
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
  await db.end().catch(() => {});
}
