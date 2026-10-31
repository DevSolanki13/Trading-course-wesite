import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("purchase settlement enforces authoritative money, unique course access, rollback, completion and refunds", async () => {
  const db = new PGlite();
  const user = "11111111-1111-4111-8111-111111111111";
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}');
 create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt()returns jsonb language sql stable as $$select '{}'::jsonb$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
    const root = new URL("../backend/database/migrations/", import.meta.url);
    for (const file of (await readdir(root)).filter((f) => f.endsWith(".sql")).sort())
      await db.exec(await readFile(new URL(file, root), "utf8"));
    await db.query("insert into auth.users(id,email)values($1,'fixture@example.invalid')", [user]);
    const course = (
      await db.query<{ id: string }>(
        "insert into courses(slug,title,price_paise,status)values('purchase-fixture','Purchase fixture',10000,'published')returning id",
      )
    ).rows[0].id;
    const moduleId = (
      await db.query<{ id: string }>(
        "insert into modules(course_id,title,position)values($1,'Start',0)returning id",
        [course],
      )
    ).rows[0].id;
    const lesson = (
      await db.query<{ id: string }>(
        "insert into lessons(module_id,title,position,duration_seconds,published)values($1,'Lesson',0,60,true)returning id",
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
    const id = await create();
    assert.equal(await create(), id);
    const claim = "22222222-2222-4222-8222-222222222222";
    assert.equal(
      (
        await db.query<{ ok: boolean }>("select purchase_claim_creation($1,$2,$3)as ok", [
          user,
          id,
          claim,
        ])
      ).rows[0].ok,
      true,
    );
    assert.equal(
      (
        await db.query<{ ok: boolean }>("select purchase_claim_creation($1,$2,$3)as ok", [
          user,
          id,
          claim,
        ])
      ).rows[0].ok,
      false,
    );
    await db.query("select purchase_bind_order($1,$2,$3,$4)", [user, id, claim, `mock_${id}`]);
    const event = {
      provider: "mock",
      providerOrderId: `mock_${id}`,
      providerPaymentId: `mock_tx_${id}`,
      amount: 10000,
      currency: "INR",
      status: "paid",
    };
    const settle = (e = event) => db.query("select purchase_settle($1)", [JSON.stringify(e)]);
    await assert.rejects(settle({ ...event, amount: 1 }), /mismatch/);
    await assert.rejects(
      db.query("select purchase_complete($1,$2,true)", [user, lesson]),
      /Purchase to unlock/,
    );
    await db.exec(
      "create function fixture_fail()returns trigger language plpgsql as $$begin raise exception 'grant failure';end;$$;create trigger fixture_fail before insert on enrollments for each row execute function fixture_fail()",
    );
    await assert.rejects(settle(), /grant failure/);
    assert.equal((await db.query("select * from purchase_access")).rows.length, 0);
    assert.equal((await db.query("select * from notification_outbox")).rows.length, 0);
    await db.exec("drop trigger fixture_fail on enrollments");
    await settle();
    await settle();
    assert.equal((await db.query("select * from purchase_access where active")).rows.length, 1);
    assert.equal((await db.query("select * from enrollments where active")).rows.length, 1);
    await assert.rejects(create(), /Already enrolled/);
    await db.query("select purchase_complete($1,$2,true)", [user, lesson]);
    assert.ok(
      (await db.query<{ completed_at: unknown }>("select completed_at from lesson_progress"))
        .rows[0].completed_at,
    );
    await settle({ ...event, status: "failed" });
    assert.equal(
      (await db.query<{ status: string }>("select status from orders where id=$1", [id])).rows[0]
        .status,
      "paid",
    );
    await settle({ ...event, status: "refunded" });
    await settle();
    assert.equal((await db.query("select * from purchase_access where active")).rows.length, 0);
    await db.exec("set role authenticated");
    await assert.rejects(db.exec("select purchase_settle('{}')"), /permission denied/);
    await assert.rejects(db.exec("select * from purchase_access"), /permission denied/);
  } finally {
    await db.close();
  }
});
