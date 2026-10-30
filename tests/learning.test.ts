import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { hasCourseAccess, refundEligibility, snapshotMatches } from "../backend/learning/policy.ts";

test("enrollment requires active access and a matching paid purchase or manual grant", () => {
  const e = {
    course_id: "course",
    active: true,
    revoked_at: null,
    source: "purchase",
    order_id: "order",
  };
  const o = { id: "order", course_id: "course", user_id: "user", status: "paid" };
  assert.equal(hasCourseAccess([e], [o], "course", "user"), true);
  for (const status of ["pending", "failed", "cancelled", "refunded"])
    assert.equal(hasCourseAccess([e], [{ ...o, status }], "course", "user"), false);
  assert.equal(hasCourseAccess([e], [{ ...o, user_id: "other" }], "course", "user"), false);
  assert.equal(
    hasCourseAccess([{ ...e, revoked_at: new Date().toISOString() }], [o], "course", "user"),
    false,
  );
  assert.equal(
    hasCourseAccess([{ ...e, source: "manual", order_id: null }], [], "course", "user"),
    true,
  );
});
test("refund display uses exact time/watch boundaries and refuses missing snapshots", () => {
  const policy = { window_days: 7, watch_limit_percent: 10 };
  const paid = "2026-10-01T00:00:00Z";
  const now = Date.parse(paid) + 6 * 86400000;
  assert.equal(refundEligibility(paid, "paid", policy, 100, 9.99, now).eligible, true);
  assert.equal(refundEligibility(paid, "paid", policy, 100, 10, now).eligible, false);
  assert.equal(refundEligibility(paid, "paid", policy, 100, 0, now + 86400000).eligible, false);
  assert.equal(refundEligibility(paid, "paid", policy, undefined, 0, now).eligible, false);
  const lessons = [
    { id: "paid", duration: 100, preview: false },
    { id: "preview", duration: 20, preview: true },
  ];
  const snapshot = {
    duration_seconds: 100,
    lessons: [
      { id: "paid", duration_seconds: 100, is_preview: false },
      { id: "preview", duration_seconds: 20, is_preview: true },
    ],
  };
  assert.equal(snapshotMatches(snapshot, lessons), true);
  assert.equal(snapshotMatches({ ...snapshot, duration_seconds: 120 }, lessons), false);
  assert.equal(snapshotMatches(snapshot, [{ ...lessons[0], duration: 110 }, lessons[1]]), false);
  assert.equal(snapshotMatches({ duration_seconds: 100 }, lessons), false);
});
test("learning SQL enforces access, heartbeat ordering, unique watched ranges and server time", async () => {
  const db = new PGlite();
  const user = "11111111-1111-4111-8111-111111111111";
  const session = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
 create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb not null default '{}');
 create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
    for (const file of (await readdir(new URL("../backend/database/migrations/", import.meta.url)))
      .filter((n) => n.endsWith(".sql"))
      .sort())
      await db.exec(
        await readFile(new URL(`../backend/database/migrations/${file}`, import.meta.url), "utf8"),
      );
    await db.query("insert into auth.users(id,email)values($1,'fixture@example.invalid')", [user]);
    await db.query("insert into auth.sessions(id,user_id)values($1,$2)", [session, user]);
    const course = (
      await db.query<{ id: string }>(
        "insert into courses(slug,title,price_paise,status)values('test','Test',100,'published')returning id",
      )
    ).rows[0].id;
    const moduleId = (
      await db.query<{ id: string }>(
        "insert into modules(course_id,title,position)values($1,'Module',0)returning id",
        [course],
      )
    ).rows[0].id;
    const lesson = (
      await db.query<{ id: string }>(
        "insert into lessons(module_id,title,position,duration_seconds,published)values($1,'Lesson',0,100,true)returning id",
        [moduleId],
      )
    ).rows[0].id;
    await db.query("select auth_admit_device($1,$2,'Test',true,null)", [user, session]);
    await assert.rejects(
      db.query("select learning_start($1,$2,$3)", [user, session, lesson]),
      /Access denied/,
    );
    await db.query("insert into enrollments(user_id,course_id,source)values($1,$2,'manual')", [
      user,
      course,
    ]);
    let lease = (
      await db.query<{ state: { leaseId: string } }>("select learning_start($1,$2,$3) as state", [
        user,
        session,
        lesson,
      ])
    ).rows[0].state.leaseId;
    const beat = async (seq: number, position: number, playing = true, seeking = false) =>
      (
        await db.query<{ state: { watchedSeconds: number; position: number } }>(
          "select learning_heartbeat($1,$2,$3,$4,$5,$6,$7,1) as state",
          [user, session, lease, seq, position, playing, seeking],
        )
      ).rows[0].state;
    await beat(1, 0);
    await db.exec("update learning_playbacks set last_at=clock_timestamp()-interval '5 seconds'");
    assert.equal(Number((await beat(2, 5000)).watchedSeconds), 5);
    await assert.rejects(beat(2, 5000), /Invalid heartbeat/);
    assert.equal(
      Number((await beat(3, 90000, true, true)).watchedSeconds),
      5,
      "seek jump earns no credit",
    );
    await beat(4, 0, true, true);
    await beat(5, 0);
    await db.exec("update learning_playbacks set last_at=clock_timestamp()-interval '5 seconds'");
    assert.equal(Number((await beat(6, 5000)).watchedSeconds), 5, "replayed ranges merge");
    await db.query("select learning_complete($1,$2,$3,true)", [user, session, lesson]);
    assert.equal(
      Number((await beat(7, 5000)).watchedSeconds),
      5,
      "checkbox does not award watched time",
    );
    const oldLease = lease;
    lease = (
      await db.query<{ state: { leaseId: string } }>("select learning_start($1,$2,$3) as state", [
        user,
        session,
        lesson,
      ])
    ).rows[0].state.leaseId;
    assert.notEqual(lease, oldLease);
    await assert.rejects(
      db.query("select learning_heartbeat($1,$2,$3,8,5000,true,false,1)", [
        user,
        session,
        oldLease,
      ]),
      /expired or replaced/,
    );
    await db.exec("set role authenticated");
    await assert.rejects(db.exec("select * from learning_playbacks"), /permission denied/);
    await assert.rejects(
      db.query("select learning_start($1,$2,$3)", [user, session, lesson]),
      /permission denied/,
    );
    await assert.rejects(
      db.exec("update lesson_progress set completed=false"),
      /permission denied/,
    );
    await db.exec("reset role;update enrollments set active=false");
    await assert.rejects(beat(1, 5000), /Access denied/);
  } finally {
    await db.close();
  }
});
