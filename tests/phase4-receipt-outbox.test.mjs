import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { finishNotification } from "../backend/scripts/notification-result.mjs";

test("receipt prompt and sweep share durable claims, backoff, recovery and idempotency bounds", async () => {
  const db = new PGlite();
  const user = "11111111-1111-4111-8111-111111111111";
  const order = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}');
      create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
      create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt()returns jsonb language sql stable as $$select '{}'::jsonb$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const root = new URL("../backend/database/migrations/", import.meta.url);
    for (const file of (await readdir(root)).filter((file) => file.endsWith(".sql")).sort())
      await db.exec(await readFile(new URL(file, root), "utf8"));
    await db.query("insert into auth.users(id,email)values($1,'student@example.invalid')", [user]);
    await db.query(
      "insert into notification_outbox(user_id,dedupe_key,subject,body)values($1,$2,'Receipt','Saved total INR 100.00')",
      [user, `purchase:${order}`],
    );
    const prompt = async (owner = user) =>
      (await db.query("select purchase_mail_claim($1,$2) as result", [owner, order])).rows[0]
        .result;
    const sweep = async () => (await db.query("select * from notification_claim()")).rows;
    assert.equal(await prompt(order), null); // wrong owner
    const first = await prompt();
    assert.equal(first.attempts, 1);
    assert.equal(await prompt(), null);
    assert.equal((await sweep()).length, 0); // live lease excludes overlapping sweep
    await db.query("select purchase_mail_finish($1,$2,false)", [first.id, first.attempts]);
    assert.equal(await prompt(), null);
    assert.equal((await sweep()).length, 0); // future retry is respected
    await db.exec("update notification_outbox set next_attempt_at=now()-interval '1 second'");
    const retry = (await sweep())[0];
    assert.equal(retry.attempts, 2);
    assert.equal(retry.dedupe_key, first.dedupe_key);
    assert.equal(
      new Date(retry.delivery_started_at).getTime(),
      new Date(first.delivery_started_at).getTime(),
    );
    assert.equal(await finishNotification(db, first, true), false); // stale prompt
    await db.exec("update notification_outbox set claimed_until=now()-interval '1 second'");
    const recovered = (await sweep())[0]; // crashed worker is recoverable
    assert.equal(recovered.attempts, 3);
    assert.equal(recovered.dedupe_key, first.dedupe_key);
    assert.equal(await finishNotification(db, retry, true), false);
    assert.equal(await finishNotification(db, recovered, true), true);
    assert.equal(await prompt(), null);
    assert.equal((await sweep()).length, 0); // sent cannot be redelivered
    for (const limit of [
      "attempts=8",
      "attempts=1,delivery_started_at=now()-interval '24 hours'",
    ]) {
      await db.exec(
        `update notification_outbox set state='failed',next_attempt_at=now()-interval '1 second',${limit}`,
      );
      assert.equal(await prompt(), null);
      assert.equal((await sweep()).length, 0);
    }
    assert.equal((await db.query("select * from notification_outbox")).rows.length, 1);
  } finally {
    await db.close();
  }
});
