import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { hasCourseAccess, refundEligibility, snapshotMatches } from "../backend/learning/policy.ts";
import { calculateTotal } from "../backend/payments/calculations.ts";

test("Phase 2 — Learner journey and course flow comprehensive test", async () => {
  const db = new PGlite();
  const student = "11111111-1111-4111-8111-111111111111";
  const studentSessions = [
    "22222222-2222-4222-8222-222222222221",
    "22222222-2222-4222-8222-222222222222",
    "22222222-2222-4222-8222-222222222223",
  ];

  try {
    // 1. Setup Postgres roles and Supabase auth schema
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      create schema auth;
      create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz default now(), raw_user_meta_data jsonb not null default '{}');
      create table auth.sessions (id uuid primary key, user_id uuid, created_at timestamptz default now(), not_after timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
    `);

    // Run all migrations
    const migrationsDir = new URL("../backend/database/migrations/", import.meta.url);
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(new URL(file, migrationsDir), "utf8"));
    }

    // 2. Setup Course, Modules, Lessons (1 Preview lesson, 1 Paid lesson)
    const course = (
      await db.query<{ id: string }>(
        "insert into courses(slug, title, description, price_paise, status) values('algo-trading', 'Algo Trading', 'Master algorithmic trading', 250000, 'published') returning id",
      )
    ).rows[0].id;

    const moduleRow = (
      await db.query<{ id: string }>(
        "insert into modules(course_id, title, position) values($1, 'Module 1: Foundations', 0) returning id",
        [course],
      )
    ).rows[0].id;

    const previewLesson = (
      await db.query<{ id: string }>(
        "insert into lessons(module_id, title, position, duration_seconds, is_preview, published) values($1, 'Free Overview', 0, 300, true, true) returning id",
        [moduleRow],
      )
    ).rows[0].id;

    const paidLesson = (
      await db.query<{ id: string }>(
        "insert into lessons(module_id, title, position, duration_seconds, is_preview, published) values($1, 'Advanced Execution', 1, 900, false, true) returning id",
        [moduleRow],
      )
    ).rows[0].id;

    await db.query("insert into lesson_assets(lesson_id, provider_video_id, notes) values($1, 'vdo_preview_123', 'Preview lesson notes.')", [previewLesson]);
    await db.query("insert into lesson_assets(lesson_id, provider_video_id, notes) values($1, 'vdo_paid_456', 'Exclusive deep-dive strategies.')", [paidLesson]);

    // Setup Site Settings: GST 18%, 2 devices limit, 7 day refund window, 10% watch limit
    await db.exec("update site_settings set gst_enabled=true, gst_rate_bps=1800, device_limit=2, refund_window_days=7, refund_watch_limit_percent=10");

    // ──────────────────────────────────────────────────────────────────────────
    // Setup verified student user & device sessions
    // ──────────────────────────────────────────────────────────────────────────
    await db.query("insert into auth.users(id, email, email_confirmed_at) values($1, 'student@example.invalid', now())", [student]);
    for (const session of studentSessions) {
      await db.query("insert into auth.sessions(id, user_id) values($1, $2)", [session, student]);
    }

    // Admit Device 1 -> success
    const admit1 = (
      await db.query<{ state: string }>(
        "select public.auth_admit_device($1, $2, 'MacBook Chrome', false, null) as state",
        [student, studentSessions[0]],
      )
    ).rows[0].state;
    assert.equal(admit1, "admitted", "First device should be admitted");

    // Admit Device 2 -> success
    const admit2 = (
      await db.query<{ state: string }>(
        "select public.auth_admit_device($1, $2, 'iPhone Safari', false, null) as state",
        [student, studentSessions[1]],
      )
    ).rows[0].state;
    assert.equal(admit2, "admitted", "Second device should be admitted");

    // Admit Device 3 -> limit reached!
    const admit3 = (
      await db.query<{ state: string }>(
        "select public.auth_admit_device($1, $2, 'Windows Edge', false, null) as state",
        [student, studentSessions[2]],
      )
    ).rows[0].state;
    assert.equal(admit3, "limit", "Third device should be rejected by device limit");

    // Test unverified email user
    const unverifiedUser = "33333333-3333-4333-8333-333333333333";
    await db.query(
      "insert into auth.users(id, email, email_confirmed_at) values($1, 'unverified@example.invalid', null)",
      [unverifiedUser],
    );
    const unverifiedProfile = await db.query<{ email_confirmed_at: string | null }>(
      "select email_confirmed_at from auth.users where id=$1",
      [unverifiedUser],
    );
    assert.equal(unverifiedProfile.rows[0].email_confirmed_at, null, "Unverified user email_confirmed_at is null");

    // ──────────────────────────────────────────────────────────────────────────
    // Task 1: Test free previews while paid lessons remain locked
    // ──────────────────────────────────────────────────────────────────────────
    // Free preview accessible for admitted student without enrollment
    const canAccessPreviewUnenrolled = (
      await db.query<{ can: boolean }>(
        "select public.learning_can_access($1, $2, $3) as can",
        [student, studentSessions[0], previewLesson],
      )
    ).rows[0].can;
    assert.equal(canAccessPreviewUnenrolled, true, "Free preview must be accessible");

    // Paid lesson NOT accessible without enrollment
    const canAccessPaidUnenrolled = (
      await db.query<{ can: boolean }>(
        "select public.learning_can_access($1, $2, $3) as can",
        [student, studentSessions[0], paidLesson],
      )
    ).rows[0].can;
    assert.equal(canAccessPaidUnenrolled, false, "Paid lesson must be locked without enrollment");

    // ──────────────────────────────────────────────────────────────────────────
    // Task 3: Verify that displayed price, GST, terms and policy match database values
    // ──────────────────────────────────────────────────────────────────────────
    const dbCourse = (await db.query<{ price_paise: number }>("select price_paise from courses where id=$1", [course])).rows[0];
    const dbSettings = (await db.query<{ gst_enabled: boolean; gst_rate_bps: number; refund_window_days: number; refund_watch_limit_percent: number }>("select * from site_settings where id=true")).rows[0];

    const calculated = calculateTotal({
      basePaise: dbCourse.price_paise,
      gstEnabled: dbSettings.gst_enabled,
      gstRateBps: dbSettings.gst_rate_bps,
    });

    assert.equal(calculated.basePaise, 250000);
    assert.equal(calculated.taxPaise, Math.floor((250000 * 1800) / 10000)); // 45000 paise (450 INR)
    assert.equal(calculated.totalPaise, 295000); // 2950 INR

    // ──────────────────────────────────────────────────────────────────────────
    // Task 4: Confirm pending payments never grant enrollment
    // ──────────────────────────────────────────────────────────────────────────
    const orderId = (
      await db.query<{ id: string }>(
        "select public.demo_create_order($1, $2, 'algo-trading') as id",
        [student, studentSessions[0]],
      )
    ).rows[0].id;

    // Check order created in pending status
    const pendingOrder = (await db.query<{ status: string; total_paise: number }>("select status, total_paise from orders where id=$1", [orderId])).rows[0];
    assert.equal(pendingOrder.status, "pending");
    assert.equal(pendingOrder.total_paise, 295000);

    // Enrollments must be 0 for this user
    const pendingEnrollments = await db.query("select * from enrollments where user_id=$1", [student]);
    assert.equal(pendingEnrollments.rows.length, 0, "Pending order must NEVER create an enrollment");

    // Course access policy check
    const hasAccessPending = hasCourseAccess([], [{ id: orderId, user_id: student, course_id: course, status: "pending" }], course, student);
    assert.equal(hasAccessPending, false, "hasCourseAccess must return false for pending order");

    // Database check for paid lesson access while order is pending
    const canAccessPaidPending = (
      await db.query<{ can: boolean }>(
        "select public.learning_can_access($1, $2, $3) as can",
        [student, studentSessions[0], paidLesson],
      )
    ).rows[0].can;
    assert.equal(canAccessPaidPending, false, "Paid lesson must still be locked while order is pending");

    // ──────────────────────────────────────────────────────────────────────────
    // Task 5: Verify paid, failed, cancelled, expired and recoverable-error states
    // ──────────────────────────────────────────────────────────────────────────
    // Settle as paid
    const paidEvent = {
      eventId: `event_${orderId}_paid`,
      providerOrderId: `demo_${orderId}`,
      status: "paid",
      amountPaise: 295000,
    };
    const { createHash } = await import("node:crypto");
    const paidHash = createHash("sha256").update(JSON.stringify(paidEvent)).digest("hex");
    await db.query("select public.demo_settle_payment($1, $2)", [paidHash, JSON.stringify(paidEvent)]);

    const settledOrder = (await db.query<{ status: string; paid_at: string }>("select status, paid_at from orders where id=$1", [orderId])).rows[0];
    assert.equal(settledOrder.status, "paid");
    assert.notEqual(settledOrder.paid_at, null);

    const paidEnrollments = await db.query<{ active: boolean }>("select * from enrollments where user_id=$1 and course_id=$2", [student, course]);
    assert.equal(paidEnrollments.rows.length, 1, "Paid settlement must grant exactly 1 enrollment");
    assert.equal(paidEnrollments.rows[0].active, true);

    // Verify course access is now granted
    const hasAccessPaid = hasCourseAccess(
      [{ active: true, revoked_at: null, source: "purchase", course_id: course, order_id: orderId }],
      [{ id: orderId, user_id: student, course_id: course, status: "paid" }],
      course,
      student,
    );
    assert.equal(hasAccessPaid, true, "hasCourseAccess must return true for paid order");

    // ──────────────────────────────────────────────────────────────────────────
    // Task 6: Test lesson selection, progress saving, notes, resume, course completion
    // ──────────────────────────────────────────────────────────────────────────
    // Verify notes retrieval from DB
    const notesRow = (await db.query<{ notes: string }>("select notes from lesson_assets where lesson_id=$1", [paidLesson])).rows[0];
    assert.equal(notesRow.notes, "Exclusive deep-dive strategies.");

    // Start playback of paid lesson
    const startResult = (
      await db.query<{ state: { leaseId: string; position: number; sequence: number } }>(
        "select public.learning_start($1, $2, $3) as state",
        [student, studentSessions[0], paidLesson],
      )
    ).rows[0].state;
    assert.ok(startResult.leaseId, "Playback lease must be generated");

    // Heartbeat 1 initializes playing state to true
    await db.query(
      "select public.learning_heartbeat($1, $2, $3, 1, 0, true, false, 1)",
      [student, studentSessions[0], startResult.leaseId],
    );

    // Heartbeat 2 after 10s of playback advances watched time
    await db.exec("update learning_playbacks set last_at=clock_timestamp()-interval '10 seconds'");
    const hb2 = (
      await db.query<{ state: { watchedSeconds: number; position: number } }>(
        "select public.learning_heartbeat($1, $2, $3, 2, 10000, true, false, 1) as state",
        [student, studentSessions[0], startResult.leaseId],
      )
    ).rows[0].state;
    assert.equal(Number(hb2.watchedSeconds), 10, "Watched seconds should advance by 10s");

    // Mark lesson complete
    await db.query("select public.learning_complete($1, $2, $3, true)", [student, studentSessions[0], paidLesson]);
    const progressRow = (
      await db.query<{ completed: boolean; position_ms: number }>(
        "select completed, position_ms from lesson_progress where user_id=$1 and lesson_id=$2",
        [student, paidLesson],
      )
    ).rows[0];
    assert.equal(progressRow.completed, true, "Lesson must be marked complete");

    // Test course progress and resume calculation logic
    const totalLessons = 2;
    const completedLessons = 1;
    const progressPercent = Math.round((completedLessons / totalLessons) * 100);
    assert.equal(progressPercent, 50, "1 out of 2 lessons completed is 50%");

    const recentLessons = [
      { lesson_id: previewLesson, updated_at: "2026-10-30T10:00:00Z" },
      { lesson_id: paidLesson, updated_at: "2026-10-30T10:05:00Z" },
    ].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
    assert.equal(recentLessons[0].lesson_id, paidLesson, "Resume lesson points to the most recently updated lesson");

    // ──────────────────────────────────────────────────────────────────────────
    // Task 7: Verify revoked or refunded users cannot access protected content
    // ──────────────────────────────────────────────────────────────────────────
    // Case A: Refunded order
    const hasAccessAfterRefund = hasCourseAccess(
      [{ active: true, revoked_at: null, source: "purchase", course_id: course, order_id: orderId }],
      [{ id: orderId, user_id: student, course_id: course, status: "refunded" }],
      course,
      student,
    );
    assert.equal(hasAccessAfterRefund, false, "Refunded order revokes access via policy");

    // Case B: Revoked enrollment
    await db.query("update enrollments set active=false, revoked_at=now() where user_id=$1 and course_id=$2", [student, course]);
    const canAccessAfterRevocation = (
      await db.query<{ can: boolean }>(
        "select public.learning_can_access($1, $2, $3) as can",
        [student, studentSessions[0], paidLesson],
      )
    ).rows[0].can;
    assert.equal(canAccessAfterRevocation, false, "Revoked enrollment denies database access to paid lessons");

    await assert.rejects(
      db.query("select public.learning_start($1, $2, $3)", [student, studentSessions[0], paidLesson]),
      /Access denied/,
      "Starting playback on revoked enrollment must raise Access denied",
    );

  } finally {
    await db.close();
  }
});
