import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { fingerprint, type PaymentConfirmation } from "../backend/payments/workflow.ts";

test("commerce SQL: verified snapshots, attempt retries, atomic documents/access/email, refund and worker fences", async () => {
  const db = new PGlite();
  const user = "11111111-1111-4111-8111-111111111111",
    session = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}');
      create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
      create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const root = new URL("../backend/database/migrations/", import.meta.url);
    for (const file of (await readdir(root)).filter((name) => name.endsWith(".sql")).sort())
      await db.exec(await readFile(new URL(file, root), "utf8"));
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at)values($1,'fixture@example.invalid',now())",
      [user],
    );
    await db.query("insert into auth.sessions(id,user_id)values($1,$2)", [session, user]);
    await db.query("select auth_admit_device($1,$2,'Fixture',true,null)", [user, session]);
    const course = (
      await db.query<{ id: string }>(
        "insert into courses(slug,title,price_paise,sale_price_paise,status)values('cashfree-fixture','Fixture',10000,9000,'published')returning id",
      )
    ).rows[0].id;
    const moduleId = (
      await db.query<{ id: string }>(
        "insert into modules(course_id,title,position)values($1,'Start',0)returning id",
        [course],
      )
    ).rows[0].id;
    await db.query(
      "insert into lessons(module_id,title,position,duration_seconds,published)values($1,'Lesson',0,600,true)",
      [moduleId],
    );
    const create = () =>
      db.query<{ id: string }>(
        "select commerce_create_order($1,$2,'cashfree-fixture','9876543210')as id",
        [user, session],
      );
    await db.exec("update auth.users set email_confirmed_at=null");
    await assert.rejects(create(), /Verified session/);
    await db.exec(
      "update auth.users set email_confirmed_at=now();update site_settings set gst_enabled=true",
    );
    await assert.rejects(create(), /GST invoice configuration/);
    await db.exec("update site_settings set gst_enabled=false");
    const id = (await create()).rows[0].id;
    assert.equal((await create()).rows[0].id, id);
    const providerOrderId = `cf_sbx_${id.replaceAll("-", "")}`;
    const stored = (
      await db.query<{ total_paise: number; billing_snapshot: { customer_phone: string } }>(
        "select total_paise,billing_snapshot from orders where id=$1",
        [id],
      )
    ).rows[0];
    assert.equal(stored.total_paise, 9000);
    assert.equal(stored.billing_snapshot.customer_phone, "9876543210");
    const event: PaymentConfirmation = {
      providerOrderId,
      paymentId: "10001",
      amountPaise: 9000,
      currency: "INR",
      status: "FAILED",
      paidAt: null,
    };
    const settle = (value = event) =>
      db.query("select commerce_settle_payment($1,$2)", [
        fingerprint(value),
        JSON.stringify(value),
      ]);
    await settle();
    assert.equal(
      (await db.query<{ status: string }>("select status from orders where id=$1", [id])).rows[0]
        .status,
      "pending",
    );
    assert.equal((await db.query("select * from enrollments")).rows.length, 0);
    await assert.rejects(settle({ ...event, amountPaise: 8999 }), /Order mismatch/);
    event.paymentId = "10002";
    event.status = "SUCCESS";
    event.paidAt = new Date().toISOString();
    await assert.rejects(
      settle({ ...event, paidAt: new Date(0).toISOString() }),
      /Invalid paid time/,
    );
    await db.exec(
      "create function fixture_deny_grant()returns trigger language plpgsql as $$begin raise exception 'fixture grant failed';end;$$;create trigger fixture_deny_grant before insert on enrollments for each row execute function fixture_deny_grant()",
    );
    await assert.rejects(settle(), /fixture grant failed/);
    assert.equal((await db.query("select * from billing_documents")).rows.length, 0);
    assert.equal(
      (await db.query("select * from notification_outbox where dedupe_key like 'purchase:%'")).rows
        .length,
      0,
    );
    assert.equal(
      (await db.query<{ status: string }>("select status from orders where id=$1", [id])).rows[0]
        .status,
      "pending",
    );
    await db.exec("drop trigger fixture_deny_grant on enrollments");
    await settle();
    await settle();
    assert.equal((await db.query("select * from enrollments where active")).rows.length, 1);
    const otherOrder = (
      await db.query<{ id: string }>(
        "insert into orders(user_id,course_id,provider_order_id,base_paise,total_paise)values($1,$2,'cf_sbx_44444444444444448444444444444444',9000,9000)returning id",
        [user, course],
      )
    ).rows[0].id;
    await assert.rejects(
      settle({ ...event, providerOrderId: "cf_sbx_44444444444444448444444444444444" }),
      /Payment reused/,
    );
    assert.equal(
      (await db.query("select * from enrollments where order_id=$1", [otherOrder])).rows.length,
      0,
    );
    assert.equal((await db.query("select * from billing_documents")).rows.length, 1);
    assert.equal(
      (await db.query("select * from notification_outbox where dedupe_key like 'purchase:%'")).rows
        .length,
      1,
    );
    await assert.rejects(create(), /Already enrolled/);
    await assert.rejects(
      db.exec("update orders set total_paise=8000,base_paise=8000 where status='paid'"),
      /immutable/,
    );
    await settle({ ...event, status: "FAILED" });
    assert.equal(
      (
        await db.query<{ status: string }>(
          "select status from payment_attempts where provider_payment_id='10002'",
        )
      ).rows[0].status,
      "SUCCESS",
    );
    const before = (await db.query<{ snapshot: unknown }>("select snapshot from billing_documents"))
      .rows[0].snapshot;
    await db.exec("update courses set title='Edited after purchase',price_paise=999999");
    assert.deepEqual(
      (await db.query<{ snapshot: unknown }>("select snapshot from billing_documents")).rows[0]
        .snapshot,
      before,
    );
    const request = (
      await db.query<{ id: string; provider_reference: string }>(
        "insert into refund_requests(order_id,user_id,reason,requested_evidence,reviewed_by)values($1,$2,'Fixture refund','{}',$2)returning id,provider_reference",
        [id, user],
      )
    ).rows[0];
    await assert.rejects(
      db.query("select commerce_refund_state($1,$2,9000,'SUCCESS')", [
        request.provider_reference,
        providerOrderId,
      ]),
      /Refund not approved/,
    );
    await db.query("update refund_requests set state='approved'where id=$1", [request.id]);
    await db.query("select commerce_refund_state($1,$2,9000,'PENDING')", [
      request.provider_reference,
      providerOrderId,
    ]);
    assert.equal((await db.query("select * from enrollments where active")).rows.length, 1);
    await assert.rejects(
      db.query("select commerce_refund_state($1,$2,8999,'SUCCESS')", [
        request.provider_reference,
        providerOrderId,
      ]),
      /mismatch/,
    );
    await db.query("select commerce_refund_state($1,$2,9000,'REJECTED')", [
      request.provider_reference,
      providerOrderId,
    ]);
    assert.equal((await db.query("select * from enrollments where active")).rows.length, 1);
    await db.query("select commerce_refund_state($1,$2,9000,'SUCCESS')", [
      request.provider_reference,
      providerOrderId,
    ]);
    await db.query("select commerce_refund_state($1,$2,9000,'SUCCESS')", [
      request.provider_reference,
      providerOrderId,
    ]);
    assert.equal((await db.query("select * from enrollments where active")).rows.length, 0);
    assert.equal(
      (await db.query("select * from billing_documents where kind='credit_note'")).rows.length,
      1,
    );
    await settle();
    assert.equal((await db.query("select * from enrollments where active")).rows.length, 0);
    const jobs = (
      await db.query<{ id: string; attempts: number }>("select * from commerce_claim_jobs()")
    ).rows;
    assert.equal(jobs.length, 2);
    assert.equal((await db.query("select * from commerce_claim_jobs()")).rows.length, 0);
    const job = jobs[0];
    assert.equal(
      (
        await db.query<{ ok: boolean }>("select commerce_finish_job($1,$2,true)as ok", [
          job.id,
          job.attempts + 1,
        ])
      ).rows[0].ok,
      false,
    );
    assert.equal(
      (
        await db.query<{ ok: boolean }>("select commerce_finish_job($1,$2,true)as ok", [
          job.id,
          job.attempts,
        ])
      ).rows[0].ok,
      true,
    );
    const notifications = (
      await db.query<{ delivery_started_at: string }>("select * from notification_claim()")
    ).rows;
    assert.ok(notifications.length > 0);
    assert.ok(notifications.every((row) => row.delivery_started_at));
    await db.exec(
      "update notification_outbox set state='failed',attempts=1,delivery_started_at=now()-interval '24 hours',next_attempt_at=now()-interval '1 hour'",
    );
    assert.equal((await db.query("select * from notification_claim()")).rows.length, 0);
    await db.exec("set role service_role");
    await assert.rejects(
      db.exec("update billing_documents set snapshot='{}'"),
      /permission denied/,
    );
    await db.exec("reset role;set role authenticated");
    await assert.rejects(db.exec("select * from billing_documents"), /permission denied/);
    await assert.rejects(db.exec("select commerce_settle_payment(null,'{}')"), /permission denied/);
    await assert.rejects(db.exec("select commerce_claim_jobs()"), /permission denied/);
    await assert.rejects(db.exec("select commerce_ops_summary()"), /permission denied/);
  } finally {
    await db.close();
  }
});
