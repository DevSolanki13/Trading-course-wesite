import "./load-env.mjs";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import * as OTPAuth from "otpauth";
import pg from "pg";
import { verifyStagingTarget } from "./database-target.mjs";
if (process.env.PROJECT_STAGE !== "staging") throw Error("Staging required");
const origin = "http://127.0.0.1:3000";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const db = new pg.Client({
  ...verifyStagingTarget(),
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const contexts = [];
const users = [];
const checks = [];
let courseId, uiCourseId, uiSlug, moduleId, lessonId, orderId, refundId, couponId;
let step = "initialisation";
const password = `Aa9-${randomBytes(20).toString("hex")}`;
const pass = (label) => {
  checks.push(label);
  console.log(`PASS ${label}`);
};
mkdirSync(".impeccable/review", { recursive: true });
async function fixture(role) {
  const email = `phase5-${randomUUID()}@example.invalid`;
  const r = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Staging ${role}` },
  });
  if (r.error || !r.data.user) throw Error("Fixture user unavailable");
  users.push(r.data.user.id);
  if (role !== "student") {
    const p = await admin.from("profiles").update({ role }).eq("id", r.data.user.id);
    if (p.error) throw Error("Fixture role unavailable");
  }
  return { id: r.data.user.id, email };
}
async function context() {
  const c = await browser.newContext({
    baseURL: origin,
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  contexts.push(c);
  return c;
}
async function post(c, path, data) {
  return c.request.post(path, { data, headers: { Origin: origin } });
}
async function login(c, u) {
  const r = await post(c, "/api/auth/login", { email: u.email, password, remember: false });
  assert.equal(r.status(), 200);
}
async function mfa(c) {
  const r = await post(c, "/api/auth/mfa/enroll", {});
  assert.equal(r.status(), 200);
  const d = await r.json();
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(d.secret),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  const v = await post(c, "/api/auth/mfa/verify", { factorId: d.factorId, code: totp.generate() });
  assert.equal(v.status(), 200);
}
async function action(c, name, data, status = 200) {
  const r = await post(c, "/api/admin/operations", { action: name, data });
  assert.equal(r.status(), status, `${name} status`);
  return r.json();
}
async function insert(table, values) {
  const r = await admin.from(table).insert(values).select().single();
  if (r.error || !r.data) throw Error("Fixture insert failed");
  return r.data;
}
try {
  const serverProbe = await fetch(`${origin}/api/auth/options`, {
    signal: AbortSignal.timeout(3000),
  }).catch(() => null);
  if (!serverProbe || !serverProbe.ok) {
    throw new Error(`Application server not running at ${origin}. Please start 'npm run dev' or 'npm start' in another terminal first.`);
  }
  await db.connect();
  const owner = await fixture("admin"),
    support = await fixture("support"),
    student = await fixture("student");
  const a = await context(),
    s = await context(),
    u = await context();
  await login(a, owner);
  await login(s, support);
  await login(u, student);
  step = "authentication and role boundaries";
  assert.equal((await a.request.get("/api/admin/overview")).status(), 403);
  assert.equal((await s.request.get("/api/admin/overview")).status(), 403);
  assert.equal((await u.request.get("/api/admin/students")).status(), 403);
  await mfa(a);
  await mfa(s);
  assert.equal((await a.request.get("/api/admin/overview")).status(), 200);
  assert.equal((await s.request.get("/api/admin/students")).status(), 200);
  assert.equal((await s.request.get("/api/admin/courses")).status(), 403);
  assert.equal((await s.request.get("/api/admin/settings")).status(), 403);
  assert.equal((await s.request.get("/api/admin/staff")).status(), 403);
  assert.equal(
    (
      await action(
        s,
        "block",
        { userId: student.id, blocked: true, note: "Support cannot block" },
        403,
      )
    ).code,
    "FORBIDDEN",
  );
  pass("Admin/Support MFA, student denial and restricted direct endpoints");
  step = "course builder and provider publication";
  const slug = `phase5-${randomUUID()}`;
  const courseData = {
    title: "Staging course editor verification",
    slug,
    description: "Disposable course for the owner-authorised Phase 5 test.",
    price_paise: 10000,
    sale_price_paise: null,
    level: "beginner",
    language: "Hindi",
    thumbnail_url: "",
    outcomes: [],
    audience: "",
    prerequisites: "",
    artwork: "foundations",
  };
  const created = await action(a, "course_save", courseData);
  courseId = created.id;
  assert.ok(courseId);
  assert.equal((await action(s, "course_save", courseData, 403)).code, "FORBIDDEN");
  const mod = await action(a, "module_save", { courseId, version: 1, title: "Verified module" });
  moduleId = mod.id;
  const vd = await (await a.request.get("/api/admin/video-test")).json();
  assert.equal(vd.status, "ready");
  const l = await action(a, "lesson_save", {
    courseId,
    version: 2,
    moduleId,
    title: "Protected verified lesson",
    duration_seconds: vd.duration,
    videoId: vd.videoId,
    notes: "An authorised test note. This course is removed after checks.",
    is_preview: false,
    published: true,
    resources: [{ title: "Worksheet", content: "Record your observation." }],
  });
  lessonId = l.id;
  const published = await action(a, "course_state", { courseId, version: 3, status: "published" });
  assert.equal(published.courseId, courseId);
  const detail = await (await a.request.get(`/api/admin/course?id=${courseId}`)).json();
  assert.equal(detail.course.status, "published");
  assert.equal(detail.course.modules[0].lessons.length, 1);
  assert.equal(detail.course.modules[0].lessons[0].lesson_assets.provider_video_id, vd.videoId);
  const lastLesson=await action(a,"lesson_save",{courseId,version:4,moduleId,id:lessonId,title:"Protected verified lesson",duration_seconds:vd.duration,videoId:vd.videoId,notes:"An authorised test note.",is_preview:false,published:false,resources:[]},400);
  assert.match(lastLesson.error,/Unpublish the course/);
  const publicPage = await u.request.get(`/courses/${slug}`);
  assert.equal(publicPage.status(), 200);
  assert.match(await publicPage.text(), /Staging course editor verification/);
  const sitemap = await (await u.request.get("/sitemap.xml")).text();
  assert.match(sitemap, new RegExp(slug));
  const coupon = await action(a, "coupon", {
    code: `P5${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
    kind: "percent", value: 1000, courseId, expiresAt: null,
    totalLimit: 10, perUserLimit: 1, active: true,
  });
  couponId = coupon.id;
  assert.ok(couponId);
  const forbiddenCoupon = await action(s, "coupon", {
    code: "SUPPORT10", kind: "percent", value: 1000, courseId,
    expiresAt: null, totalLimit: 10, perUserLimit: 1, active: true,
  }, 403);
  assert.equal(forbiddenCoupon.code, "FORBIDDEN");
  pass(
    "atomic course/module/lesson builder, verified provider publication, coupon admin boundary and fourth-course public listing",
  );
  step="course-builder browser authoring";
  const editor=await a.newPage();await editor.goto("/admin",{waitUntil:"networkidle"});await editor.getByRole("button",{name:"Courses",exact:true}).first().click();await editor.getByRole("button",{name:"New course"}).click();
  uiSlug=`phase5-ui-${randomUUID()}`;
  await editor.getByRole("textbox",{name:"Course title"}).fill("Staging UI authoring check");
  await editor.getByRole("textbox",{name:"URL slug"}).fill(uiSlug);
  await editor.getByRole("spinbutton",{name:"Base price (INR)"}).fill("100");
  await editor.getByRole("button",{name:"Save course details"}).click();
  await editor.getByRole("heading",{name:"Staging UI authoring check"}).waitFor();
  const uiRecord=await admin.from("courses").select("id,status").eq("slug",uiSlug).single();assert.equal(uiRecord.error,null);uiCourseId=uiRecord.data.id;assert.equal(uiRecord.data.status,"draft");
  const draftPage = await u.request.get(`/courses/${uiSlug}`);
  assert.match(await draftPage.text(), /A little off course/);
  await editor.getByRole("button",{name:"Curriculum"}).click();await editor.getByRole("textbox",{name:"New module title"}).fill("Hands-on learning");await editor.getByRole("button",{name:"Add module"}).click();await editor.getByRole("textbox",{name:"Module title"}).waitFor();assert.equal(await editor.getByRole("textbox",{name:"Module title"}).inputValue(),"Hands-on learning");await editor.screenshot({path:".impeccable/review/admin-course-editor.png",fullPage:true});
  await editor.close();pass("browser course draft and module authoring stay private until verified publication");
  const supportFilters=await s.request.get("/api/admin/order-filters");assert.equal(supportFilters.status(),200);
  const filterCourses=(await supportFilters.json()).courses;assert.ok(filterCourses.some(course=>course.id===courseId));assert.ok(!filterCourses.some(course=>course.id===uiCourseId));
  step = "student and financial boundaries";
  const staffGrant=await action(s,"grant",{userId:owner.id,courseId,note:"Staff grant must be denied"},403);
  assert.equal(staffGrant.code,"FORBIDDEN");
  assert.equal(
    (await action(s, "grant", { userId: student.id, courseId, note: "Authorised staging access" }))
      .message,
    "Saved successfully.",
  );
  assert.equal((await u.request.get(`/api/learning/lesson?id=${lessonId}`)).status(), 200);
  const p = await insert("orders", {
    user_id: student.id,
    course_id: courseId,
    status: "paid",
    paid_at: new Date().toISOString(),
    base_paise: 10000,
    total_paise: 10000,
    course_snapshot: {
      title: "Staging course editor verification",
      watch_tracking_version: 1,
      duration_seconds: vd.duration,
      lessons: [{ id: lessonId, duration_seconds: vd.duration, is_preview: false }],
    },
  });
  orderId = p.id;
  await insert("enrollments", {
    user_id: student.id,
    course_id: courseId,
    source: "purchase",
    order_id: orderId,
  });
  const r = await post(u, "/api/refunds", {
    orderId,
    reason: "Please review this staging purchase",
  });
  assert.equal(r.status(), 200);
  refundId = (await r.json()).id;
  assert.equal(
    (
      await post(u, "/api/refunds", { orderId, reason: "Please review this staging purchase" })
    ).status(),
    200,
  );
  const queue = await (await s.request.get("/api/admin/refunds")).json();
  const req = queue.items.find((x) => x.id === refundId);
  assert.ok(req.current_evidence.eligible);
  await action(s, "refund_decide", {
    id: refundId,
    version: req.version,
    decision: "approve",
    note: "Within recorded limits",
    goodwill: false,
  });
  const reviewedQueue = await (await s.request.get("/api/admin/refunds")).json();
  const reviewed = reviewedQueue.items.find((x) => x.id === refundId);
  assert.equal(reviewed.state, "approved");
  assert.equal(reviewed.version, req.version + 1);
  const approved = await db.query(
    "select r.state,o.status from refund_requests r join orders o on o.id=r.order_id where r.id=$1",
    [refundId],
  );
  assert.equal(approved.rows[0].state, "approved");
  assert.equal(approved.rows[0].status, "paid", "Approval cannot move money");
  const notices = await db.query(
    "select count(*)::int as n from notification_outbox where dedupe_key=$1",
    [`refund:${refundId}:approved`],
  );
  assert.equal(notices.rows[0].n, 1);
  const filtered=await(await a.request.get(`/api/admin/orders?courseId=${courseId}&status=paid&userId=${student.id}`)).json();
  assert.ok(filtered.items.some(item=>item.id===orderId));
  const disabledRefund=await post(a,"/api/admin/refund-process",{requestId:refundId});
  assert.equal(disabledRefund.status(),503);
  assert.equal((await disabledRefund.json()).code,"PAYMENTS_DEFERRED");
  const summary = await (await a.request.get("/api/admin/overview?range=all")).json();
  assert.ok(summary.gross >= 10000);
  assert.ok(summary.sales >= 1);
  const csv = await (await a.request.get("/api/admin/export")).text();
  assert.match(csv, /Staging course editor verification/);
  assert.equal((await s.request.get("/api/admin/export")).status(), 403);
  const ref = (
    await db.query("select provider_reference from refund_requests where id=$1", [refundId])
  ).rows[0].provider_reference;
  assert.equal(
    (await db.query("select refund_settled($1,true)as settled", [ref])).rows[0].settled,
    true,
  );
  assert.equal(
    (await db.query("select refund_settled($1,true)as settled", [ref])).rows[0].settled,
    false,
  );
  const rights = await db.query(
    "select source,active from enrollments where user_id=$1 and course_id=$2",
    [student.id, courseId],
  );
  assert.equal(
    rights.rows.some((x) => x.source === "manual" && x.active),
    true,
  );
  assert.equal(
    rights.rows.some((x) => x.source === "purchase" && !x.active),
    true,
  );
  const tasks=await(await a.request.get("/api/admin/tasks")).json();
  assert.ok(tasks.items.some(task=>task.request_id===refundId&&task.qualifyingPaidAccessNow===false));
  const messages=await(await a.request.get("/api/admin/notifications")).json();
  assert.ok(messages.items.some(message=>message.subject==="Refund confirmed"));
  const audit=await(await a.request.get("/api/admin/audit")).json();
  assert.ok(audit.items.some(item=>item.action==="refund_decide"));
  assert.equal((await s.request.get("/api/admin/tasks")).status(),403);
  pass(
    "Support grant/refund review, frozen evidence, no provider action on approval, safe export and idempotent synthetic settlement",
  );
  step="student blocking and forced logout";
  await action(a,"block",{userId:student.id,blocked:true,note:"Disposable staging access check"});
  assert.equal((await u.request.get("/api/auth/me")).status(),403);
  await action(a,"block",{userId:student.id,blocked:false,note:"Restore disposable staging account"});
  assert.equal((await u.request.get("/api/auth/me")).status(),401);
  await login(u,student);
  assert.equal((await u.request.get("/api/auth/me")).status(),200);
  await action(a,"logout_student",{userId:student.id,note:"Disposable forced sign-out check"});
  assert.equal((await u.request.get("/api/auth/me")).status(),401);
  pass("Admin block, unblock and force logout revoke access while preserving account history");
  step = "admin panels accessibility";
  const page = await a.newPage();
  const audits = [];
  for (const theme of ["dark", "light"]) {
    await a.addInitScript((t) => localStorage.setItem("market-method-theme", t), theme);
    for (const width of [1440, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin", { waitUntil: "networkidle" });
      await page.evaluate(t=>{localStorage.setItem("market-method-theme",t);document.documentElement.dataset.theme=t;window.dispatchEvent(new Event("theme-change"));},theme);
      assert.equal(await page.locator("html").getAttribute("data-theme"),theme);
      await page.getByRole("heading", { name: "Overview" }).waitFor();
      for (const tab of ["Overview", "Courses", "Students", "Orders", "Refunds", "Settings", "Coupons", "Site content", "Operations", "Audit"]) {
        await page.getByRole("button", { name: tab, exact: true }).first().click();
        await page.waitForTimeout(150);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
          `${theme} ${width} ${tab} overflow`,
        );
        if (["Overview", "Courses", "Refunds", "Settings", "Students", "Site content"].includes(tab)) {
          if(tab==="Settings")await page.getByRole("heading",{name:"Tax and billing"}).waitFor();
          const audit = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          audits.push({
            theme,
            width,
            tab,
            violations: audit.violations.map((v) => ({
              id: v.id,
              targets: v.nodes.map((n) => n.target),
            })),
          });
        }
      }
    }
  }
  writeFileSync(".impeccable/review/admin-a11y.json", JSON.stringify(audits, null, 2));
  assert.equal(
    audits.flatMap((a) => a.violations).length,
    0,
    "Admin accessibility issues recorded in local report",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button",{name:"Overview",exact:true}).first().click();
  await page.screenshot({ path: ".impeccable/review/admin-dashboard.png" });
  const supportPage=await s.newPage();await supportPage.goto("/admin",{waitUntil:"networkidle"});await supportPage.getByRole("heading",{name:"Overview"}).waitFor();
  assert.equal(await supportPage.getByRole("button",{name:"Courses",exact:true}).count(),0);
  assert.equal(await supportPage.getByRole("button",{name:"Settings",exact:true}).count(),0);
  await supportPage.getByRole("button",{name:"Students",exact:true}).click();await supportPage.getByRole("heading",{name:"Students",exact:true}).waitFor();await supportPage.close();
  pass("admin workspace viewport/theme navigation and targeted accessibility checks");
} catch (error) {
  const safeMessage = error?.message
    ? String(error.message).replace(
        /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|([0-9a-f]{8}-[0-9a-f-]{27,})/gi,
        "[redacted]",
      )
    : "Details withheld";
  console.error(`FAIL ${step}: ${safeMessage}`);
  process.exitCode = 1;
} finally {
  writeFileSync(
    ".impeccable/review/admin-verification.json",
    JSON.stringify({ at: new Date().toISOString(), checks }, null, 2),
  );
  try {
    if (courseId) {
      await db.query("begin");
      await db.query("delete from notification_outbox where user_id=any($1::uuid[])", [users]);
      await db.query("delete from operations_tasks where user_id=any($1::uuid[])", [users]);
      if (refundId) await db.query("delete from refund_decisions where request_id=$1", [refundId]);
      await db.query(
        "delete from refund_requests where order_id in(select id from orders where course_id=$1)",
        [courseId],
      );
      await db.query(
        "delete from order_watch_ranges where order_id in(select id from orders where course_id=$1)",
        [courseId],
      );
      await db.query("delete from learning_playbacks where user_id=any($1::uuid[])", [users]);
      await db.query("delete from lesson_progress where user_id=any($1::uuid[])", [users]);
      await db.query("delete from enrollments where course_id=$1", [courseId]);
      await db.query("delete from orders where course_id=$1", [courseId]);
      await db.query(
        "delete from coupon_redemptions where coupon_id in(select id from coupons where course_id=$1)",
        [courseId],
      );
      await db.query("delete from coupons where course_id=$1", [courseId]);
      await db.query(
        "delete from lesson_resources where lesson_id in(select l.id from lessons l join modules m on m.id=l.module_id where m.course_id=$1)",
        [courseId],
      );
      await db.query(
        "delete from lesson_assets where lesson_id in(select l.id from lessons l join modules m on m.id=l.module_id where m.course_id=$1)",
        [courseId],
      );
      await db.query(
        "delete from lessons where module_id in(select id from modules where course_id=$1)",
        [courseId],
      );
      await db.query("delete from modules where course_id=$1", [courseId]);
      await db.query("delete from courses where id=$1", [courseId]);
      if(!uiCourseId&&uiSlug){const found=await db.query("select id from courses where slug=$1",[uiSlug]);uiCourseId=found.rows[0]?.id;}
      if(uiCourseId)await db.query("delete from modules where course_id=$1",[uiCourseId]);
      if(uiCourseId)await db.query("delete from courses where id=$1",[uiCourseId]);
      await db.query("commit");
    }
    if (users.length) {
      await db.query("delete from audit_log where actor_id=any($1::uuid[])", [users]);
      await db.query("delete from device_sessions where user_id=any($1::uuid[])", [users]);
      for (const id of users) {
        const d = await admin.auth.admin.deleteUser(id);
        if (d.error) throw Error("Fixture identity cleanup failed");
      }
    }
    console.log("Disposable Phase 5 staging fixtures cleaned up.");
  } catch {
    console.error("Fixture cleanup needs operator review; identifiers withheld.");
    process.exitCode = 1;
  }
  await Promise.all(contexts.map((c) => c.close().catch(() => {})));
  await browser.close();
  await db.end().catch(() => {});
}
