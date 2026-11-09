import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  purchaseReceiptHref,
  type PurchaseOrdersPage,
  type PurchaseHistoryCursor,
} from "../shared/purchase.ts";

test("isolated migrated combined history: keysets, summaries, pending discovery, UPI wrapper and privileges", async (t) => {
  const db = new PGlite();
  const owner = "10000000-0000-4000-8000-000000000001";
  const other = "10000000-0000-4000-8000-000000000002";
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
    await db.exec(`insert into auth.users(id)values('${owner}'),('${other}');
      insert into courses(id,slug,title,price_paise,status)values('20000000-0000-4000-8000-000000000001','history-fixture','Live title',10000,'published');
      insert into orders(id,user_id,course_id,purchase_provider,provider_order_id,status,base_paise,total_paise,course_snapshot,created_at,paid_at)
      select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${owner}','20000000-0000-4000-8000-000000000001',
       case n%5 when 0 then 'upi'when 1 then 'razorpay'when 2 then 'mock'else null end,
       case when n%5=3 then 'cf_sbx_'||n else 'fixture_'||n end,
       case n%4 when 0 then 'pending'when 1 then 'paid'when 2 then 'refunded'else 'failed'end,
       10000+n,10000+n,'{"title":"Historical title","slug":"historical-slug"}',
       '2026-11-09 10:00:00.123456+00'::timestamptz-(n/30)*interval '1 day',
       case when n%4 in(1,2)then '2026-11-09 11:00:00+00'::timestamptz else null end
      from generate_series(1,120)n;
      insert into orders(user_id,course_id,base_paise,total_paise)select '${other}',id,999999,999999 from courses;
      insert into upi_intents(order_id,amount_paise,vpa,payee_name,gateway_checkout_token,gateway_upi_uri)
       values('30000000-0000-4000-8000-000000000020',10020,'fixture@upi','Fixture','fixture-token','upi://pay?pa=fixture@upi&mc=1234');`);
    const read = async (
      cursor: PurchaseHistoryCursor | null = null,
      status = "all",
      provider = "all",
      pending: PurchaseHistoryCursor | null = null,
      pendingOnly = false,
    ) =>
      (
        await db.query<{ result: PurchaseOrdersPage }>(
          "select purchase_history_page($1,17,$2,$3,$4,$5,$6)as result",
          [owner, cursor, status, provider, pending, pendingOnly],
        )
      ).rows[0].result;
    let page = await read();
    assert.equal(page.totalCount, 120);
    assert.equal(page.pendingCount, 30);
    assert.equal(page.totalAmount, 120 * 10000 + (120 * 121) / 2);
    const seen = [...page.orders];
    while (page.nextCursor) {
      page = await read(page.nextCursor);
      seen.push(...page.orders);
    }
    assert.equal(seen.length, 120);
    assert.equal(new Set(seen.map((o) => o.id)).size, 120);
    const expected = (
      await db.query<{ id: string }>(
        "select id from orders where user_id=$1 order by created_at desc,id desc",
        [owner],
      )
    ).rows.map((o) => o.id);
    assert.deepEqual(
      seen.map((o) => o.id),
      expected,
    );
    assert.ok(seen.every((o) => o.courseTitle === "Historical title"));
    assert.deepEqual(
      new Set(seen.map((o) => o.provider)),
      new Set(["upi", "mock", "razorpay", "cashfree", "demo"]),
    );
    for (const order of seen.filter((o) => ["paid", "refunded"].includes(o.status)))
      assert.equal(
        purchaseReceiptHref(order),
        ["cashfree", "demo"].includes(order.provider)
          ? `/api/orders/${order.id}/document`
          : `/dashboard/orders/${order.id}/receipt`,
      );
    const filtered = await read(null, "paid", "cashfree");
    assert.equal(filtered.totalCount, 120);
    assert.equal(filtered.filteredCount, 6);
    assert.ok(filtered.orders.every((o) => o.provider === "cashfree" && o.status === "paid"));
    let paidPage = await read(null, "paid");
    const paidIds = paidPage.orders.map((o) => o.id);
    while (paidPage.nextCursor) {
      paidPage = await read(paidPage.nextCursor, "paid");
      paidIds.push(...paidPage.orders.map((o) => o.id));
    }
    assert.equal(paidPage.filteredCount, 30);
    assert.equal(new Set(paidIds).size, 30);
    const pendingIds: string[] = [];
    let pendingCursor: PurchaseHistoryCursor | null = null;
    do {
      const pending = await read(null, "failed", "mock", pendingCursor, true);
      assert.equal(pending.orders.length, 0);
      assert.ok(pending.pending.length <= 4);
      pendingIds.push(...pending.pending.map((o) => o.id));
      pendingCursor = pending.nextPendingCursor;
    } while (pendingCursor);
    assert.equal(new Set(pendingIds).size, 30);
    const oldest = pendingIds.at(-1)!;
    await db.query("update orders set status='paid',paid_at=now()where id=$1", [oldest]);
    const settled = await read();
    assert.equal(settled.pendingCount, 29);
    assert.equal(settled.totalCount, 120);
    assert.equal(settled.totalAmount, filtered.totalAmount);
    assert.ok(settled.paidAmount > filtered.paidAmount);
    const upi = (
      await db.query<{ result: { upi: { uri: string; gateway: string } } }>(
        "select purchase_read('order',$1,'30000000-0000-4000-8000-000000000020')as result",
        [owner],
      )
    ).rows[0].result;
    assert.equal(upi.upi.uri, "upi://pay?pa=fixture@upi&mc=1234");
    assert.equal(upi.upi.gateway, "indianxtrade");
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(read(), /permission denied/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    assert.equal((await read()).totalCount, 120);
    await db.exec("reset role");
    await assert.rejects(db.query("select purchase_history_page(null)"), /Sign in/);
    await assert.rejects(
      db.query("select purchase_history_page($1,51)", [owner]),
      /Invalid history/,
    );
    await assert.rejects(
      db.query("select purchase_history_page($1,20,'{}')", [owner]),
      /Invalid cursor/,
    );

    // Tied-date distribution: compare the existing index against the additive cursor index.
    await db.exec(`insert into orders(user_id,course_id,base_paise,total_paise,created_at,status)
      select '${other}','20000000-0000-4000-8000-000000000001',100,100,'2026-01-01','paid' from generate_series(1,4000);
      insert into orders(user_id,course_id,base_paise,total_paise,created_at)
      select '${other}','20000000-0000-4000-8000-000000000001',100,100,'2025-01-01' from generate_series(1,4);analyze orders;`);
    const pendingSql =
      "select id,created_at from orders where user_id=$1 and status='pending' order by created_at desc,id desc limit 5";
    const pendingAfter = (
      await db.query(`explain(analyze,buffers,format json) ${pendingSql}`, [other])
    ).rows;
    assert.match(JSON.stringify(pendingAfter), /orders_pending_cursor_idx/);
    await db.exec("drop index orders_pending_cursor_idx");
    const pendingBefore = (
      await db.query(`explain(analyze,buffers,format json) ${pendingSql}`, [other])
    ).rows;
    const sql =
      "select id,created_at from orders where user_id=$1 and(created_at,id)<('2026-01-02', 'ffffffff-ffff-ffff-ffff-ffffffffffff')order by created_at desc,id desc limit 21";
    const explain = async () =>
      (await db.query(`explain(analyze,buffers,format json) ${sql}`, [other])).rows;
    const after = await explain();
    assert.match(JSON.stringify(after), /orders_history_cursor_idx/);
    await db.exec("drop index orders_history_cursor_idx");
    const before = await explain();
    t.diagnostic(
      JSON.stringify({
        fixture: "120 mixed-provider orders, 4000 paid tied-date comparison orders + 5 pending",
        before,
        after,
        pendingBefore,
        pendingAfter,
        scope: "isolated PGlite; no hosted measurement",
      }),
    );
  } finally {
    await db.close();
  }
});
