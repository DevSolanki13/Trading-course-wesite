import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("Academy UPI queues isolate course orders, mirror shared credits atomically, and cannot grant access", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}');
      create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
      create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt()returns jsonb language sql stable as $$select '{}'::jsonb$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const root = new URL("../backend/database/migrations/", import.meta.url);
    for (const file of (await readdir(root)).filter((name) => name.endsWith(".sql")).sort())
      await db.exec(await readFile(new URL(file, root), "utf8"));
    const user = "11111111-1111-4111-8111-111111111111";
    await db.query("insert into auth.users(id,email)values($1,'student@example.invalid')", [user]);
    const course = (
      await db.query<{ id: string }>(
        "insert into courses(slug,title,price_paise,status)values('upi-admin','UPI admin test',100000,'published')returning id",
      )
    ).rows[0].id;
    const order = (
      await db.query<{ id: string }>("select purchase_create_order($1,$2,'upi','') as id", [
        user,
        course,
      ])
    ).rows[0].id;
    await db.query("select purchase_upi_reserve($1,$2,'academy@bank','Academy')", [user, order]);
    const token = "academy_checkout_1234567890123456";
    await db.query("update upi_intents set gateway_checkout_token=$2 where order_id=$1", [
      order,
      token,
    ]);
    const secret = "private-display-only-test-secret-".repeat(2);
    await db.query("insert into academy_upi_sync(secret_hash) values($1)", [
      createHash("sha256").update(secret).digest("hex"),
    ]);
    const now = Date.now();
    const snapshot = {
      version: 1,
      complete: true,
      sourceAt: new Date(now).toISOString(),
      deposits: [
        {
          token,
          amount: 100000,
          status: "COMPLETED",
          utr: "123456789012",
          updatedAt: new Date(now).toISOString(),
        },
        {
          token: "unbound_trading_1234567890123456",
          amount: 100000,
          status: "PENDING_CONFIRMATION",
          utr: "trade-utr",
          updatedAt: new Date(now).toISOString(),
        },
      ],
      credits: [
        {
          id: "credit",
          amount: 99900,
          utr: "unmatched-utr",
          receivedAt: new Date(now).toISOString(),
        },
      ],
    };
    const sync = (data: object, key = secret) =>
      db.query("select academy_upi_sync_snapshot($1,$2)", [key, JSON.stringify(data)]);
    const read = async (tab: string, query = "", page = 0) =>
      (
        await db.query<{
          result: {
            items: Record<string, unknown>[];
            total: number;
            counts: { review: number; unmatched: number };
            syncedAt: string;
          };
        }>("select academy_upi_payment_read($1,$2,$3) as result", [tab, query, page])
      ).rows[0].result;
    await assert.rejects(sync(snapshot, "incorrect-key"), /Sync denied/);
    await sync(snapshot);
    const review = await read("review");
    assert.equal(review.total, 1);
    assert.equal(review.items[0].id, order);
    assert.equal(review.items[0].reviewReason, "Payment received; course access pending");
    assert.deepEqual(review.counts, { review: 1, unmatched: 1 });
    assert.equal((await read("review", "trade-utr")).total, 0);
    assert.equal((await read("history", "student@example.invalid")).total, 1);
    assert.equal((await read("history", "1000")).total, 1);
    assert.equal((await read("history", "1000.00")).total, 1);
    assert.equal((await read("history", "123456789012")).total, 1);
    assert.equal((await read("unmatched", "999")).total, 1);
    assert.equal((await read("unmatched", "999.00")).total, 1);
    assert.equal((await read("unmatched", "' OR 1=1 --")).total, 0);
    assert.equal((await read("review", "", 1)).items.length, 0);
    await assert.rejects(read("usdt"), /Invalid payment view/);
    // A completed display snapshot never settles an order or grants enrollment.
    assert.equal(
      (await db.query<{ status: string }>("select status from orders where id=$1", [order])).rows[0]
        .status,
      "pending",
    );
    assert.equal(
      (await db.query("select id from enrollments where order_id=$1", [order])).rows.length,
      0,
    );
    await assert.rejects(sync({ ...snapshot, complete: false }), /Invalid snapshot/);
    await assert.rejects(
      sync({
        ...snapshot,
        sourceAt: new Date(now + 1000).toISOString(),
        credits: [{ id: "bad", utr: "bad", amount: -1, receivedAt: new Date(now).toISOString() }],
      }),
    );
    assert.equal((await read("unmatched")).total, 1);
    await sync({ ...snapshot, sourceAt: new Date(now - 1000).toISOString(), credits: [] });
    assert.equal((await read("unmatched")).total, 1);
    await sync({ ...snapshot, sourceAt: new Date(now + 2000).toISOString(), credits: [] });
    assert.equal((await read("unmatched")).total, 0);
    // No public key or ordinary signed-in browser can read a mirror or its secret hash.
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(read("history"), /permission denied/);
      await assert.rejects(db.query("select * from academy_upi_sync"), /permission denied/);
      await assert.rejects(
        db.query("select * from academy_upi_payment_orders"),
        /permission denied/,
      );
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});
