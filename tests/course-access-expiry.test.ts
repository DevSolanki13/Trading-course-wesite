import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { hasCourseAccess } from "../backend/learning/policy.ts";

test("course access requires a valid future expiry, including manual grants", () => {
  const enrollment = {
    course_id: "course",
    source: "manual",
    order_id: null,
    active: true,
    revoked_at: null,
  };
  const now = Date.parse("2026-11-01T00:00:00Z");
  for (const expiry of [undefined, null, "invalid", "2026-11-01T00:00:00Z", "2026-10-31T23:59:59Z"])
    assert.equal(
      hasCourseAccess([{ ...enrollment, expires_at: expiry }], [], "course", "user", now),
      false,
    );
  assert.equal(
    hasCourseAccess(
      [{ ...enrollment, expires_at: "2026-11-01T00:00:01Z" }],
      [],
      "course",
      "user",
      now,
    ),
    true,
  );
});

test("SQL freezes purchased terms, denies expired access, preserves progress and renews once", async () => {
  const db = new PGlite();
  const user = "11111111-1111-4111-8111-111111111111";
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}');
      create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
      create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt()returns jsonb language sql stable as $$select '{}'::jsonb$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
    const root = new URL("../backend/database/migrations/", import.meta.url);
    const migrations = (await readdir(root)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of migrations.filter((f) => !f.includes("0011_")))
      await db.exec(await readFile(new URL(file, root), "utf8"));
    await db.query("insert into auth.users(id,email)values($1,'expiry@example.invalid')", [user]);
    const course = (
      await db.query<{ id: string }>(
        "insert into courses(slug,title,price_paise,status)values('expiry','Expiry',10000,'published')returning id",
      )
    ).rows[0].id;
    // Existing manual grants also become finite when the additive migration is applied.
    await db.query(
      "insert into enrollments(user_id,course_id,source,granted_at)values($1,$2,'manual','2026-01-31T12:00:00Z')",
      [user, course],
    );
    await db.exec(
      await readFile(
        new URL(
          migrations.find((f) => f.includes("0011_"))!,
          root,
        ),
        "utf8",
      ),
    );
    assert.equal(
      (await db.query<{ expiry: string }>("select expires_at::text as expiry from enrollments"))
        .rows[0].expiry,
      "2026-02-28 12:00:00+00",
    );
    assert.equal(
      (
        await db.query<{ expiry: string }>(
          "select course_access_end('2028-01-31T12:00:00Z',1,'months')::text as expiry",
        )
      ).rows[0].expiry,
      "2028-02-29 12:00:00+00",
    );
    await assert.rejects(db.query("update courses set access_period=0 where id=$1", [course]));
    await assert.rejects(
      db.query("update courses set access_unit='lifetime' where id=$1", [course]),
    );
    const moduleId = (
      await db.query<{ id: string }>(
        "insert into modules(course_id,title,position)values($1,'Module',0)returning id",
        [course],
      )
    ).rows[0].id;
    const lesson = (
      await db.query<{ id: string }>(
        "insert into lessons(module_id,title,position,duration_seconds,published)values($1,'Paid',0,60,true)returning id",
        [moduleId],
      )
    ).rows[0].id;
    const create = async () =>
      (
        await db.query<{ id: string }>(
          "select purchase_create_order($1,$2,'mock','http://localhost:3000')as id",
          [user, course],
        )
      ).rows[0].id;
    const settle = async (id: string) => {
      await db.query("update orders set provider_order_id=$2 where id=$1", [id, `mock_${id}`]);
      await db.query("select purchase_settle($1)", [
        JSON.stringify({
          provider: "mock",
          providerOrderId: `mock_${id}`,
          providerPaymentId: `tx_${id}`,
          amount: 10000,
          currency: "INR",
          status: "paid",
        }),
      ]);
    };
    const first = await create();
    await db.query("update courses set access_period=2 where id=$1", [course]);
    await settle(first);
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "select expires_at=course_access_end(o.paid_at,1,'months')as ok from enrollments e join orders o on o.id=e.order_id where o.id=$1",
          [first],
        )
      ).rows[0].ok,
      true,
    );
    await db.query("select purchase_complete($1,$2,true)", [user, lesson]);
    await db.query("update enrollments set expires_at=now() where order_id=$1", [first]);
    assert.equal(
      (await db.query<{ ok: boolean }>("select purchase_has_access($1,$2)as ok", [user, course]))
        .rows[0].ok,
      false,
    );
    await assert.rejects(
      db.query("select purchase_read('lesson',$1,$2)", [user, lesson]),
      /Purchase to unlock/,
    );
    await assert.rejects(
      db.query("select purchase_complete($1,$2,true)", [user, lesson]),
      /Purchase to unlock/,
    );
    const renewal = await create();
    assert.notEqual(renewal, first);
    await settle(renewal);
    await settle(renewal);
    assert.equal(
      (await db.query<{ ok: boolean }>("select purchase_has_access($1,$2)as ok", [user, course]))
        .rows[0].ok,
      true,
    );
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "select expires_at=course_access_end(o.paid_at,2,'months')as ok from enrollments e join orders o on o.id=e.order_id where o.id=$1",
          [renewal],
        )
      ).rows[0].ok,
      true,
    );
    assert.equal(
      (
        await db.query<{ completed: boolean }>(
          "select completed from lesson_progress where lesson_id=$1",
          [lesson],
        )
      ).rows[0].completed,
      true,
    );
    assert.equal(
      (await db.query("select * from enrollments where order_id=$1", [renewal])).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
