import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { csvCell, csvRows } from "../backend/admin/policy.ts";
test("CSV export neutralises spreadsheet formula cells", () => {
  assert.equal(csvCell("=HYPERLINK(1)"), '"\'=HYPERLINK(1)"');
  assert.equal(csvCell("\t+CMD"), '"\'\t+CMD"');
  assert.ok(
    csvRows([
      ["a", "b"],
      ["x, y", 'z"q'],
    ]).startsWith("\ufeff"),
  );
});
test("admin SQL: course publishing, role fences, grants, refund evidence and idempotent settlement", async () => {
  const db = new PGlite();
  const ids = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
  ];
  const sessions = [
    "44444444-4444-4444-8444-444444444441",
    "44444444-4444-4444-8444-444444444442",
    "44444444-4444-4444-8444-444444444443",
  ];
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now(),raw_user_meta_data jsonb not null default '{}');
create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
    for (const file of (await readdir(new URL("../backend/database/migrations/", import.meta.url)))
      .filter((v) => v.endsWith(".sql"))
      .sort())
      await db.exec(
        await readFile(new URL(`../backend/database/migrations/${file}`, import.meta.url), "utf8"),
      );
    for (let i = 0; i < 3; i++) {
      await db.query("insert into auth.users(id,email)values($1,$2)", [
        ids[i],
        `phase5-${i}@example.invalid`,
      ]);
      await db.query("insert into auth.sessions(id,user_id)values($1,$2)", [sessions[i], ids[i]]);
      await db.query("select auth_admit_device($1,$2,'Test',true,null)", [ids[i], sessions[i]]);
    }
    await db.query("update profiles set role='admin'where id=$1", [ids[0]]);
    await db.query("update profiles set role='support'where id=$1", [ids[1]]);
    const act = async (user: number, action: string, data: object) =>
      (
        await db.query<{ result: { id?: string; courseId?: string } }>(
          "select admin_mutate($1,$2,$3,$4::jsonb) as result",
          [ids[user], sessions[user], action, JSON.stringify(data)],
        )
      ).rows[0].result;
    const courseData = {
      courseId: null,
      title: "Verified staging course",
      slug: "verified-staging-course",
      description: "Test only",
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
    await assert.rejects(act(1, "course_save", courseData), /Role denied/);
    await assert.rejects(act(2, "course_save", courseData), /Role denied/);
    const course = (await act(0, "course_save", courseData)).id!;
    const emptyOverview = (
      await db.query<{ v: { sales: number; gross: number } }>(
        "select admin_overview($1,$2,'2000-01-01')as v",
        [ids[0], sessions[0]],
      )
    ).rows[0].v;
    assert.equal(emptyOverview.sales, 0);
    assert.equal(emptyOverview.gross, 0);
    await assert.rejects(
      act(0, "course_state", { courseId: course, version: 1, status: "published" }),
      /Publish lessons first/,
    );
    const mod = (
      await act(0, "module_save", { courseId: course, version: 1, title: "First module" })
    ).id!;
    const badLesson = {
      courseId: course,
      version: 2,
      moduleId: mod,
      title: "A lesson",
      duration_seconds: 0,
      videoId: "",
      notes: "",
      is_preview: false,
      published: false,
      provider_status: null,
      verified_duration: null,
      resources: [],
    };
    const lesson = (await act(0, "lesson_save", badLesson)).id!;
    await assert.rejects(
      act(0, "course_state", { courseId: course, version: 3, status: "published" }),
      /Publish lessons first/,
    );
    await act(0, "lesson_save", {
      ...badLesson,
      id: lesson,
      version: 3,
      duration_seconds: 100,
      videoId: "testvideo123",
      provider_status: "ready",
      verified_duration: 100,
      published: true,
    });
    await act(0, "course_state", { courseId: course, version: 4, status: "published" });
    await assert.rejects(
      act(0, "course_save", { ...courseData, courseId: course, version: 4 }),
      /Version conflict/,
    );
    const secondModule = (
      await act(0, "module_save", { courseId: course, version: 5, title: "Second module" })
    ).id!;
    await act(0, "reorder", {
      courseId: course,
      version: 6,
      kind: "modules",
      ids: [secondModule, mod],
    });
    const moduleOrder = (
      await db.query<{ id: string }>(
        "select id from modules where course_id=$1 order by position",
        [course],
      )
    ).rows.map((r) => r.id);
    assert.deepEqual(moduleOrder, [secondModule, mod]);
    const secondLesson = (
      await act(0, "lesson_save", { ...badLesson, version: 7, title: "Second draft lesson" })
    ).id!;
    await act(0, "reorder", {
      courseId: course,
      version: 8,
      kind: "lessons",
      moduleId: mod,
      ids: [secondLesson, lesson],
    });
    const lessonOrder = (
      await db.query<{ id: string }>(
        "select id from lessons where module_id=$1 order by position",
        [mod],
      )
    ).rows.map((r) => r.id);
    assert.deepEqual(lessonOrder, [secondLesson, lesson]);
    await act(1, "grant", { userId: ids[2], courseId: course, note: "Authorised offline access" });
    assert.equal(
      (
        await db.query<{ allowed: boolean }>("select learning_can_access($1,$2,$3)as allowed", [
          ids[2],
          sessions[2],
          lesson,
        ])
      ).rows[0].allowed,
      true,
    );
    await assert.rejects(
      act(1, "block", { userId: ids[2], blocked: true, note: "Support should not block" }),
      /Role denied/,
    );
    await assert.rejects(act(1, "settings", { version: 1 }), /Role denied/);
    await assert.rejects(
      act(1, "goodwill_request", { orderId: course, note: "Not a real order" }),
      /Role denied/,
    );
    const order = (
      await db.query<{ id: string }>(
        "insert into orders(user_id,course_id,status,base_paise,total_paise,paid_at,course_snapshot)values($1,$2,'paid',10000,10000,now(),$3::jsonb)returning id",
        [
          ids[2],
          course,
          JSON.stringify({
            title: "Verified staging course",
            watch_tracking_version: 1,
            duration_seconds: 100,
            lessons: [{ id: lesson, duration_seconds: 100, is_preview: false }],
          }),
        ],
      )
    ).rows[0].id;
    await db.query(
      "insert into enrollments(user_id,course_id,source,order_id)values($1,$2,'purchase',$3)",
      [ids[2], course, order],
    );
    const evidence = (
      await db.query<{ v: { valid: boolean; eligible: boolean } }>(
        "select refund_evidence($1)as v",
        [order],
      )
    ).rows[0].v;
    assert.equal(evidence.valid, true);
    assert.equal(evidence.eligible, true);
    const paidOverview = (
      await db.query<{ v: { sales: number; gross: number; net: number } }>(
        "select admin_overview($1,$2,'2000-01-01')as v",
        [ids[1], sessions[1]],
      )
    ).rows[0].v;
    assert.equal(paidOverview.sales, 1);
    assert.equal(paidOverview.gross, 10000);
    assert.equal(paidOverview.net, 10000);
    const reqId = (
      await db.query<{ id: string }>(
        "select refund_request($1,$2,$3,'Please review this purchase')as id",
        [ids[2], sessions[2], order],
      )
    ).rows[0].id;
    assert.equal(
      (
        await db.query<{ id: string }>(
          "select refund_request($1,$2,$3,'Please review this purchase')as id",
          [ids[2], sessions[2], order],
        )
      ).rows[0].id,
      reqId,
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int as n from notification_outbox where dedupe_key=$1",
          [`refund:${reqId}:requested`],
        )
      ).rows[0].n,
      1,
    );
    await act(1, "refund_decide", {
      id: reqId,
      version: 1,
      decision: "approve",
      note: "Within the recorded limits",
      goodwill: false,
    });
    await assert.rejects(
      act(1, "refund_decide", {
        id: reqId,
        version: 1,
        decision: "approve",
        note: "Duplicate review",
        goodwill: false,
      }),
      /already reviewed or stale/,
    );
    const reference = (
      await db.query<{ provider_reference: string }>(
        "select provider_reference from refund_requests where id=$1",
        [reqId],
      )
    ).rows[0].provider_reference;
    assert.equal(
      (await db.query<{ ok: boolean }>("select refund_settled($1,true)as ok", [reference])).rows[0]
        .ok,
      true,
    );
    assert.equal(
      (await db.query<{ ok: boolean }>("select refund_settled($1,true)as ok", [reference])).rows[0]
        .ok,
      false,
    );
    const grants = (
      await db.query<{ source: string; active: boolean }>(
        "select source,active from enrollments where user_id=$1",
        [ids[2]],
      )
    ).rows;
    assert.equal(grants.find((g) => g.source === "manual")?.active, true);
    assert.equal(grants.find((g) => g.source === "purchase")?.active, false);
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int as n from operations_tasks where request_id=$1",
          [reqId],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int as n from refund_decisions where request_id=$1",
          [reqId],
        )
      ).rows[0].n,
      1,
    );
    const refundedOverview = (
      await db.query<{ v: { sales: number; gross: number; net: number; refunded: number } }>(
        "select admin_overview($1,$2,'2000-01-01')as v",
        [ids[0], sessions[0]],
      )
    ).rows[0].v;
    assert.equal(refundedOverview.sales, 1);
    assert.equal(refundedOverview.gross, 10000);
    assert.equal(refundedOverview.refunded, 10000);
    assert.equal(refundedOverview.net, 0);
    await act(0, "settings", {
      version: 1,
      gst_enabled: false,
      gst_rate_bps: 1800,
      gstin: "",
      device_limit: 2,
      refund_window_days: 0,
      refund_watch_limit_percent: 10,
      business_name: "Staging test",
      business_address: "",
      support_email: "",
      public_telegram_url: "",
      public_instagram_url: "",
      private_telegram_url: "",
      private_invite_expires_at: null,
    });
    assert.equal(
      (
        await db.query<{ refund_window_days: number }>(
          "select refund_window_days from site_settings where id=true",
        )
      ).rows[0].refund_window_days,
      0,
    );
    const siteDocument = {
      heroTitle: "",
      heroAccent: "",
      heroDescription: "",
      teachingTitle: "",
      teachingDescription: "",
      instructorName: "",
      instructorBio: "",
      instructorPortraitUrl: "",
      instructorConfirmed: false,
      faqs: [],
      testimonials: [],
      genuineTestimonialsConfirmed: false,
    };
    await act(0, "content", { version: 1, document: siteDocument });
    assert.equal(
      (await db.query<{ version: number }>("select version from site_content where id=true"))
        .rows[0].version,
      2,
    );
    const couponId = (
      await act(0, "coupon", {
        code: "STAGING10",
        kind: "percent",
        value: 1000,
        courseId: course,
        expiresAt: null,
        totalLimit: 10,
        perUserLimit: 1,
        active: false,
      })
    ).id!;
    await act(0, "coupon", {
      id: couponId,
      version: 1,
      code: "STAGING10",
      kind: "percent",
      value: 1000,
      courseId: course,
      expiresAt: null,
      totalLimit: 10,
      perUserLimit: 1,
      active: true,
    });
    assert.equal(
      (
        await db.query<{ active: boolean; version: number }>(
          "select active,version from coupons where id=$1",
          [couponId],
        )
      ).rows[0].version,
      2,
    );
    const secondOrder = (
      await db.query<{ id: string }>(
        "insert into orders(user_id,course_id,status,base_paise,total_paise,paid_at,course_snapshot,refund_policy_snapshot) select user_id,course_id,'paid',base_paise,total_paise,now()-interval '20 seconds',course_snapshot,refund_policy_snapshot from orders where id=$1 returning id",
        [order],
      )
    ).rows[0].id;
    await db.query(
      "insert into enrollments(user_id,course_id,source,order_id)values($1,$2,'purchase',$3)",
      [ids[2], course, secondOrder],
    );
    const removalTask = (
      await db.query<{ id: string }>("select id from operations_tasks where request_id=$1", [reqId])
    ).rows[0].id;
    await assert.rejects(
      act(0, "task_done", { id: removalTask, note: "Do not remove a current buyer" }),
      /Buyer has qualifying paid access/,
    );
    const lease = (
      await db.query<{ value: { leaseId: string } }>("select learning_start($1,$2,$3)as value", [
        ids[2],
        sessions[2],
        lesson,
      ])
    ).rows[0].value.leaseId;
    await db.query("select learning_heartbeat($1,$2,$3,1,0,true,false,1)", [
      ids[2],
      sessions[2],
      lease,
    ]);
    await db.exec("update learning_playbacks set last_at=clock_timestamp()-interval '5.1 seconds'");
    await db.query("select learning_heartbeat($1,$2,$3,2,9990,true,false,1)", [
      ids[2],
      sessions[2],
      lease,
    ]);
    const beforeLimit = (
      await db.query<{ value: { watchedPercent: number; eligible: boolean } }>(
        "select refund_evidence($1)as value",
        [secondOrder],
      )
    ).rows[0].value;
    assert.equal(Number(beforeLimit.watchedPercent), 9.99);
    assert.equal(beforeLimit.eligible, true);
    const secondRequest = (
      await db.query<{ id: string }>("select refund_request($1,$2,$3,'Please review again')as id", [
        ids[2],
        sessions[2],
        secondOrder,
      ])
    ).rows[0].id;
    await db.exec("update learning_playbacks set last_at=clock_timestamp()-interval '2 seconds'");
    await db.query("select learning_heartbeat($1,$2,$3,3,10000,true,false,1)", [
      ids[2],
      sessions[2],
      lease,
    ]);
    const consumed = (
      await db.query<{ v: { watchedPercent: number; eligible: boolean } }>(
        "select refund_evidence($1)as v",
        [secondOrder],
      )
    ).rows[0].v;
    assert.equal(Number(consumed.watchedPercent), 10);
    assert.equal(consumed.eligible, false);
    await assert.rejects(
      act(1, "refund_decide", {
        id: secondRequest,
        version: 1,
        decision: "approve",
        note: "No exception authority",
        goodwill: false,
      }),
      /Current refund evidence is not eligible/,
    );
    await assert.rejects(
      act(1, "refund_decide", {
        id: secondRequest,
        version: 1,
        decision: "approve",
        note: "Support goodwill attempted",
        goodwill: true,
      }),
      /Only Admin can override|Current refund evidence is not eligible/,
    );
    await act(0, "refund_decide", {
      id: secondRequest,
      version: 1,
      decision: "approve",
      note: "Approved exceptional goodwill after review",
      goodwill: true,
    });
    assert.equal(
      (
        await db.query<{ goodwill: boolean }>(
          "select goodwill from refund_decisions where request_id=$1",
          [secondRequest],
        )
      ).rows[0].goodwill,
      true,
    );
    const retryReference = (
      await db.query<{ provider_reference: string }>(
        "select provider_reference from refund_requests where id=$1",
        [secondRequest],
      )
    ).rows[0].provider_reference;
    assert.equal(
      (await db.query<{ ok: boolean }>("select refund_settled($1,false)as ok", [retryReference]))
        .rows[0].ok,
      false,
    );
    assert.equal(
      (await db.query<{ status: string }>("select status from orders where id=$1", [secondOrder]))
        .rows[0].status,
      "paid",
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int as n from notification_outbox where dedupe_key=$1",
          [`refund:${secondRequest}:failed`],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (await db.query<{ ok: boolean }>("select refund_settled($1,false)as ok", [retryReference]))
        .rows[0].ok,
      false,
    );
    assert.equal(
      (await db.query<{ ok: boolean }>("select refund_settled($1,true)as ok", [retryReference]))
        .rows[0].ok,
      true,
    );
    await act(0, "task_done", {
      id: removalTask,
      note: "Confirmed removal after paid access ended",
    });
    assert.equal(
      (
        await db.query<{ state: string }>("select state from operations_tasks where id=$1", [
          removalTask,
        ])
      ).rows[0].state,
      "done",
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      db.exec("update refund_requests set state='refunded'"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec("select admin_mutate(null,null,'grant','{}')"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
