import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { DemoProvider, demoSignature, isDemoPaymentEnabled } from "../backend/payments/demo.ts";
import { contentSecurityPolicy } from "../backend/security/content-policy.ts";

test("demo payments fail closed outside explicitly selected local/staging environments", () => {
  const secure = {
    PAYMENT_MODE: "demo",
    PROJECT_STAGE: "staging",
    DEMO_PAYMENT_SECRET: "fixture-only-secret-of-at-least-32-characters",
  };
  assert.equal(isDemoPaymentEnabled(secure), true);
  for (const env of [
    { PAYMENT_MODE: "demo" },
    { PAYMENT_MODE: "demo", PROJECT_STAGE: "staging" },
    { ...secure, DEMO_PAYMENT_SECRET: "change-me-in-preview-only" },
    { PAYMENT_MODE: "demo", PROJECT_STAGE: "production" },
    { ...secure, VERCEL_ENV: "production" },
    { PAYMENT_MODE: "cashfree", PROJECT_STAGE: "staging" },
  ])
    assert.equal(isDemoPaymentEnabled(env), false);
});

test("demo signatures require a secret, fresh timestamp, strict event and original bytes", () => {
  const original = process.env.DEMO_PAYMENT_SECRET;
  try {
    delete process.env.DEMO_PAYMENT_SECRET;
    assert.throws(() => demoSignature("{}", "0"), /configured/);
    process.env.DEMO_PAYMENT_SECRET = "fixture-only-secret-of-at-least-32-characters";
    const event = {
      eventId: "test",
      providerOrderId: "demo_11111111-1111-4111-8111-111111111111",
      status: "paid",
      amountPaise: 100,
    };
    const raw = JSON.stringify(event);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signed = (payload: string, time = timestamp) =>
      new Headers({
        "x-webhook-timestamp": time,
        "x-webhook-signature": demoSignature(payload, time),
      });
    const provider = new DemoProvider();
    assert.deepEqual(provider.verifyWebhook(raw, signed(raw)), event);
    assert.throws(() => provider.verifyWebhook(raw + " ", signed(raw)), /signature/);
    assert.throws(
      () => provider.verifyWebhook(raw, signed(raw, String(Number(timestamp) - 301))),
      /Expired/,
    );
    assert.throws(
      () => provider.verifyWebhook(raw, signed(raw, String(Number(timestamp) + 301))),
      /Expired/,
    );
    for (const invalid of [
      { ...event, status: "refunded" },
      { ...event, amountPaise: -1 },
      { ...event, userId: "attacker" },
    ]) {
      const payload = JSON.stringify(invalid);
      assert.throws(() => provider.verifyWebhook(payload, signed(payload)));
    }
  } finally {
    if (original === undefined) delete process.env.DEMO_PAYMENT_SECRET;
    else process.env.DEMO_PAYMENT_SECRET = original;
  }
});

test("production script policy requires a request nonce and rejects embedding/object plugins", () => {
  const policy = contentSecurityPolicy("test-nonce");
  const scripts = policy.split(";").find((part) => part.includes("script-src"))!;
  assert.match(scripts, /nonce-test-nonce/);
  assert.doesNotMatch(scripts, /unsafe-inline|unsafe-eval/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(contentSecurityPolicy("test-nonce", true), /unsafe-eval/);
});

test("checkout and settlement are atomic, idempotent, owner-scoped and deny terminal resurrection", async () => {
  const db = new PGlite();
  const user = "11111111-1111-4111-8111-111111111111";
  const session = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb not null default '{}');
      create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const root = new URL("../backend/database/migrations/", import.meta.url);
    for (const file of (await readdir(root)).filter((f) => f.endsWith(".sql")).sort())
      await db.exec(await readFile(new URL(file, root), "utf8"));
    await db.query("insert into auth.users(id,email) values($1,'fixture@example.invalid')", [user]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [session, user]);
    await db.query("select auth_admit_device($1,$2,'Test',true,null)", [user, session]);
    const course = (
      await db.query<{ id: string }>(
        "insert into courses(slug,title,price_paise,status) values('test','Test',10000,'published') returning id",
      )
    ).rows[0].id;
    const moduleId = (
      await db.query<{ id: string }>(
        "insert into modules(course_id,title,position) values($1,'Start',0) returning id",
        [course],
      )
    ).rows[0].id;
    await db.query(
      "insert into lessons(module_id,title,position,duration_seconds,published) values($1,'Lesson',0,120,true)",
      [moduleId],
    );
    await db.exec("update site_settings set gst_enabled=true,gst_rate_bps=1800");
    const createOrder = async () =>
      (
        await db.query<{ id: string }>("select demo_create_order($1,$2,'test') as id", [
          user,
          session,
        ])
      ).rows[0].id;
    const first = await createOrder();
    assert.equal(await createOrder(), first, "retry resumes the pending order");
    const row = (
      await db.query<{ total_paise: number; course_snapshot: { duration_seconds: number } }>(
        "select * from orders where id=$1",
        [first],
      )
    ).rows[0];
    assert.equal(row.total_paise, 11800);
    assert.equal(row.course_snapshot.duration_seconds, 120);
    const settle = async (id: string, status: string, amount = 11800) => {
      const event = {
        eventId: `${id}:${status}`,
        providerOrderId: `demo_${id}`,
        status,
        amountPaise: amount,
      };
      const hash = createHash("sha256").update(JSON.stringify(event)).digest("hex");
      return db.query("select demo_settle_payment($1,$2)", [hash, JSON.stringify(event)]);
    };
    await assert.rejects(settle(first, "paid", 1), /mismatch/);
    await settle(first, "failed");
    await settle(first, "paid");
    assert.equal((await db.query("select * from enrollments")).rows.length, 0);
    const second = await createOrder();
    assert.notEqual(first, second);
    // Force the last write to fail: order + inbox must both roll back for a retry.
    await db.exec("alter table enrollments add constraint simulated_failure check(false)");
    await assert.rejects(settle(second, "paid"), /simulated_failure/);
    assert.equal(
      (await db.query<{ status: string }>("select status from orders where id=$1", [second]))
        .rows[0].status,
      "pending",
    );
    await db.exec("alter table enrollments drop constraint simulated_failure");
    await settle(second, "paid");
    await settle(second, "paid");
    assert.equal((await db.query("select * from enrollments")).rows.length, 1);
    await assert.rejects(createOrder(), /Already enrolled/);
    await db.query("update orders set status='refunded' where id=$1", [second]);
    await settle(second, "paid");
    assert.equal(
      (await db.query<{ status: string }>("select status from orders where id=$1", [second]))
        .rows[0].status,
      "refunded",
    );
    await db.exec("set role authenticated");
    await assert.rejects(createOrder(), /permission denied/);
    await assert.rejects(settle(first, "pending"), /permission denied/);
    await db.exec("reset role");
    await db.exec("update device_sessions set revoked_at=now()");
    await assert.rejects(createOrder(), /Access denied/);
  } finally {
    await db.close();
  }
});
