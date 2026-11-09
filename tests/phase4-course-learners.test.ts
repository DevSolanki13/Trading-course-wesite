import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createRequire } from "node:module";
import type { AdminCourseLearners } from "../shared/admin.ts";
import type { AdminLearnerDetail, AdminLearnerPage } from "../shared/admin-learners.ts";

test("installed Next router prioritizes the dedicated learner route over the legacy catch-all", async () => {
  const { getSortedRoutes } = createRequire(import.meta.url)(
    "next/dist/shared/lib/router/utils/sorted-routes.js",
  );
  await readFile(new URL("../app/api/admin/course-learners/route.ts", import.meta.url), "utf8");
  await readFile(new URL("../app/api/admin/[...action]/route.ts", import.meta.url), "utf8");
  const routes = getSortedRoutes(["/api/admin/[...action]", "/api/admin/course-learners"]);
  assert.deepEqual(routes, ["/api/admin/course-learners", "/api/admin/[...action]"]);
});

test("P4.6 isolated migrated learner summaries, details, boundaries and staff fences", async (t) => {
  const db = new PGlite();
  const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
  const course = id(1000),
    otherCourse = id(1001),
    emptyCourse = id(1002);
  const moduleId = id(2000),
    otherModule = id(2001);
  const lesson = id(3000),
    draft = id(3001),
    otherLesson = id(3002),
    untouched = id(3003);
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now(),raw_user_meta_data jsonb not null default '{}');
      create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const root = new URL("../backend/database/migrations/", import.meta.url);
    for (const file of (await readdir(root)).filter((f) => f.endsWith(".sql")).sort())
      await db.exec(await readFile(new URL(file, root), "utf8"));
    for (let n = 1; n <= 60; n++) {
      await db.query(
        "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3::jsonb)",
        [
          id(n),
          `learner${String(n).padStart(2, "0")}@example.invalid`,
          JSON.stringify({ full_name: n === 55 ? "Literal %_ Learner" : "Same name" }),
        ],
      );
    }
    for (const [n, role] of [
      [1, "admin"],
      [2, "support"],
      [3, "student"],
    ] as const) {
      await db.query("update profiles set role=$1 where id=$2", [role, id(n)]);
      await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [id(n + 100), id(n)]);
      await db.query("select auth_admit_device($1,$2,'Test',true,null)", [id(n), id(n + 100)]);
    }
    for (const [n, slug] of [
      [1000, "learners"],
      [1001, "other"],
      [1002, "empty"],
    ] as const)
      await db.query(
        "insert into courses(id,slug,title,price_paise,status) values($1,$2,$2,10000,'published')",
        [id(n), slug],
      );
    await db.query(
      "insert into modules(id,course_id,title,position) values($1,$2,'Module',0),($3,$4,'Other',0)",
      [moduleId, course, otherModule, otherCourse],
    );
    for (const [l, m, p, published] of [
      [lesson, moduleId, 0, true],
      [draft, moduleId, 1, false],
      [untouched, moduleId, 2, true],
      [otherLesson, otherModule, 0, true],
    ] as const)
      await db.query(
        "insert into lessons(id,module_id,title,position,duration_seconds,published) values($1,$2,'Lesson',$3,60,$4)",
        [l, m, p, published],
      );
    for (let n = 4; n <= 58; n++) {
      const order = id(n + 4000);
      await db.query(
        "insert into orders(id,user_id,course_id,status,base_paise,total_paise,paid_at) values($1,$2,$3,$4,10000,10000,now())",
        [order, id(n), course, n === 58 ? "pending" : "paid"],
      );
      await db.query(
        "insert into enrollments(user_id,course_id,source,order_id,active,revoked_at,expires_at) values($1,$2,'purchase',$3,$4,$5,$6)",
        [
          id(n),
          course,
          order,
          n !== 56,
          n === 57 ? "2020-01-01" : null,
          n === 54 ? "2020-01-01" : n === 53 ? null : "2099-01-01",
        ],
      );
    }
    await db.query(
      "insert into enrollments(user_id,course_id,source) values($1,$2,'manual'),($3,$4,'manual')",
      [id(59), course, id(60), otherCourse],
    );
    for (const l of [lesson, draft, otherLesson])
      await db.query(
        "insert into lesson_progress(user_id,lesson_id,duration_seconds,position_ms,watched,completed,updated_at) values($1,$2,60,12500,'{[0,10000),[20000,25500)}',true,'2026-01-01')",
        [id(4), l],
      );
    const legacy = (
      await db.query<{ v: AdminCourseLearners }>("select admin_course_learners($1,$2,$3) v", [
        id(1),
        id(101),
        course,
      ])
    ).rows[0].v;
    const page = async (p = 0, q = "", access = "all", actor = 1, c = course) =>
      (
        await db.query<{ v: AdminLearnerPage }>(
          "select admin_course_learner_page($1,$2,$3,$4,$5,$6) v",
          [id(actor), id(actor + 100), c, q, p, access],
        )
      ).rows[0].v;
    const details = async (user: string, c = course, actor = 1) =>
      (
        await db.query<{ v: AdminLearnerDetail }>(
          "select admin_course_learner_page($1,$2,$3,'ignored',100,'expired',$4) v",
          [id(actor), id(actor + 100), c, user],
        )
      ).rows[0].v;
    const first = await page(),
      second = await page(1);
    assert.equal(first.enrolledTotal, legacy.learners.length);
    assert.equal(first.total, 56);
    assert.equal(first.learners.length, 50);
    assert.equal(second.learners.length, 6);
    assert.equal((await page(2)).learners.length, 0);
    assert.equal((await page(10000)).total, 56);
    assert.equal(
      new Set([...first.learners, ...second.learners].map((l) => l.enrollmentId)).size,
      56,
    );
    assert.ok(!("lessons" in first.course));
    for (const summary of [...first.learners, ...second.learners]) {
      assert.ok(!("lessons" in summary));
      const old = legacy.learners.find((l) => l.id === summary.id)!;
      const { lessons: oldLessons, ...oldSummary } = old;
      const { enrollmentId, ...newSummary } = summary;
      assert.ok(enrollmentId);
      assert.deepEqual(newSummary, oldSummary);
      assert.deepEqual((await details(summary.id)).learner.lessons, oldLessons);
    }
    assert.equal((await details(id(4))).learner.watchedSeconds, 15.5);
    assert.equal((await details(id(4))).learner.progressPercent, 50);
    assert.equal((await details(id(4))).learner.lessons.length, 2);
    assert.equal((await page(0, "LEARNER55@EXAMPLE.INVALID")).total, 1);
    assert.equal((await page(0, " %_ ")).total, 1);
    assert.equal((await page(0, "does not exist")).total, 0);
    const active = await page(0, "", "active"),
      expired = await page(0, "", "expired");
    assert.equal(active.total + expired.total, first.total);
    assert.equal(expired.total, 3);
    assert.equal(active.enrolledTotal, 56);
    assert.equal((await page(0, "learner54", "active")).total, 0);
    assert.equal((await page(0, "learner54", "expired")).total, 1);
    assert.equal((await page(0, "", "all", 1, emptyCourse)).course.lessonCount, 0);
    assert.equal((await details(id(60), otherCourse)).learner.completedLessons, 0);
    await assert.rejects(details(id(60)), /Enrolled learner not found/);
    await assert.rejects(details(id(4), otherCourse), /Enrolled learner not found/);
    await assert.rejects(page(0, "", "all", 1, id(9999)), /Course not found/);
    await assert.rejects(page(-1), /Invalid learner filters/);
    await assert.rejects(page(10001), /Invalid learner filters/);
    await assert.rejects(page(0, "", "invalid"), /Invalid learner filters/);
    assert.deepEqual(await page(0, "", "all", 2), first);
    assert.deepEqual(await details(id(4), course, 2), await details(id(4)));
    await assert.rejects(page(0, "", "all", 3), /Role denied/);
    await db.query("update device_sessions set revoked_at=now() where user_id=$1", [id(2)]);
    await assert.rejects(page(0, "", "all", 2), /Session denied/);
    const local = (
      await db.query<{ v: AdminLearnerPage }>(
        "select admin_course_learner_read($1,'',0,'all',null,true) v",
        [course],
      )
    ).rows[0].v;
    assert.equal(local.enrolledTotal, 54); // Excludes manual and pending purchases.
    assert.equal(
      (
        await db.query<{ v: AdminLearnerDetail }>(
          "select admin_course_learner_read($1,'',0,'all',$2,true) v",
          [course, id(4)],
        )
      ).rows[0].v.learner.lessons[0].positionSeconds,
      12.5,
    );
    await assert.rejects(
      db.query("select admin_course_learner_read($1,'',0,'all',$2,true)", [course, id(59)]),
      /Enrolled learner not found/,
    );
    const beforeBytes = Buffer.byteLength(JSON.stringify(legacy));
    const afterBytes = Buffer.byteLength(JSON.stringify(first));
    assert.ok(afterBytes < beforeBytes);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        db.query("select admin_course_learner_page($1,$2,$3)", [id(1), id(101), course]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select admin_course_learner_read($1)", [course]),
        /permission denied/,
      );
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    assert.equal((await page()).total, 56);
    await db.exec("reset role");
    // Malformed legacy ownership cannot qualify a local-demo purchase.
    await db.query(
      "insert into orders(id,user_id,course_id,status,base_paise,total_paise,paid_at) values($1,$2,$3,'paid',10000,10000,now())",
      [id(5000), id(59), otherCourse],
    );
    await db.query(
      "insert into enrollments(user_id,course_id,source,order_id) values($1,$2,'purchase',$3)",
      [id(60), course, id(5000)],
    );
    assert.equal(
      (
        await db.query<{ v: AdminLearnerPage }>(
          "select admin_course_learner_read($1,'',0,'all',null,true) v",
          [course],
        )
      ).rows[0].v.enrolledTotal,
      54,
    );
    await assert.rejects(
      db.query("select admin_course_learner_read($1,'',0,'all',$2,true)", [course, id(60)]),
      /Enrolled learner not found/,
    );
    await db.query("insert into enrollments(user_id,course_id,source) values($1,$2,'manual')", [
      id(4),
      emptyCourse,
    ]);
    const noLessons = await details(id(4), emptyCourse);
    assert.equal(noLessons.learner.progressPercent, 0);
    assert.equal(noLessons.learner.lastActiveAt, null);
    assert.deepEqual(noLessons.learner.lessons, []);
    // A repeated enrollment keeps the historical enrollment count and deterministic page order.
    await db.query("insert into enrollments(user_id,course_id,source) values($1,$2,'manual')", [
      id(4),
      course,
    ]);
    assert.equal((await page()).total, 58);
    assert.deepEqual(await page(), await page());
    assert.equal((await details(id(4))).learner.id, id(4));
    // Large curriculum: summaries remain independent of the learner × lesson JSON payload.
    await db.query(
      "insert into lessons(module_id,title,position,duration_seconds,published) select $1,'Extra '||n,n+10,60,true from generate_series(1,100)n",
      [moduleId],
    );
    const largeLegacy = (
      await db.query<{ v: AdminCourseLearners }>("select admin_course_learners($1,$2,$3) v", [
        id(1),
        id(101),
        course,
      ])
    ).rows[0].v;
    const largePage = await page();
    const largeBeforeBytes = Buffer.byteLength(JSON.stringify(largeLegacy));
    const largeAfterBytes = Buffer.byteLength(JSON.stringify(largePage));
    assert.ok(largeAfterBytes < largeBeforeBytes / 10);
    await assert.rejects(details(id(4), course, 3), /Role denied/);
    await assert.rejects(
      db.query("select admin_course_learner_page($1,$2,$3)", [id(1), id(103), course]),
      /Session denied/,
    );
    await db.query("update profiles set blocked=true where id=$1", [id(1)]);
    await assert.rejects(page(), /Session denied/);
    t.diagnostic(
      JSON.stringify({
        beforeBytes,
        afterBytes,
        largeBeforeBytes,
        largeAfterBytes,
        fixture: "56 enrollments, 2 published lessons, unpublished and foreign progress",
        scope: "isolated fully migrated PGlite; no hosted writes",
      }),
    );
  } finally {
    await db.close();
  }
});
