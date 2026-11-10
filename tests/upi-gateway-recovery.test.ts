import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("gateway setup survives failures without duplicate creation, quote changes, token leaks or premature settlement", async () => {
  const db = new PGlite();
  const user = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const claim = "33333333-3333-4333-8333-333333333333";
  const nextClaim = "44444444-4444-4444-8444-444444444444";
  const token = "t".repeat(32);
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}');
      create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
      create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt()returns jsonb language sql stable as $$select '{}'::jsonb$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
    const root = new URL("../backend/database/migrations/", import.meta.url);
    for (const file of (await readdir(root)).filter((file) => file.endsWith(".sql")).sort())
      await db.exec(await readFile(new URL(file, root), "utf8"));
    await db.query(
      "insert into auth.users(id,email)values($1,'first@example.invalid'),($2,'other@example.invalid')",
      [user, other],
    );
    const course = (
      await db.query<{ id: string }>(
        "insert into courses(slug,title,price_paise,status)values('recovery','Recovery',149900,'published')returning id",
      )
    ).rows[0].id;
    const create = async (owner = user) =>
      (
        await db.query<{ id: string }>(
          "select purchase_create_order($1,$2,'upi','https://academy.example')as id",
          [owner, course],
        )
      ).rows[0].id;
    const order = await create();
    const prepare = async (owner = user, id = order, lease = claim) =>
      (
        await db.query<{
          setup: { state: string; token?: string; createdAt: string; retryAfter?: number };
        }>("select purchase_upi_gateway_prepare($1,$2,$3)as setup", [owner, id, lease])
      ).rows[0].setup;
    const release = (safe = false, id = order, owner = user, lease = claim) =>
      db.query("select purchase_upi_gateway_release($1,$2,$3,$4)", [owner, id, lease, safe]);
    const save = (value = token, lease = claim) =>
      db.query("select purchase_upi_gateway_save($1,$2,$3,$4)", [user, order, lease, value]);
    await assert.rejects(prepare(other), /Invalid payment setup/);
    const first = await prepare();
    assert.equal(first.state, "create");
    assert.equal((await prepare(user, order, nextClaim)).state, "busy");
    await assert.rejects(save(token, nextClaim), /conflict/);
    await assert.rejects(
      db.query("update orders set total_paise=total_paise-500 where id=$1", [order]),
      /Resume the saved payment/,
    );
    await assert.rejects(
      db.query(
        'update orders set course_snapshot=course_snapshot||\'{"coupon_code":"CHANGED"}\'::jsonb where id=$1',
        [order],
      ),
      /Resume the saved payment/,
    );

    // No token received: even after the short lease expires, creation remains uncertain.
    await db.query(
      "update orders set creation_claim_until=clock_timestamp()-interval '1 second' where id=$1",
      [order],
    );
    assert.equal((await prepare()).state, "unknown");
    await release(true);
    assert.equal(
      (await prepare()).state,
      "create",
      "definitive pre-creation failure can retry immediately",
    );
    await save();
    await release(true);
    const resumed = await prepare();
    assert.equal(resumed.state, "resume");
    assert.equal(
      resumed.token,
      token,
      "a known reservation cannot be deleted by safe-retry release",
    );
    await assert.rejects(save("z".repeat(32)), /conflict/);

    const read = (
      await db.query<{ value: unknown }>("select purchase_read('order',$1,$2)as value", [
        user,
        order,
      ])
    ).rows[0].value;
    assert.equal(JSON.stringify(read).includes(token), false);
    assert.equal((read as { upi?: unknown }).upi, undefined);
    assert.equal((await db.query("select * from purchase_access")).rows.length, 0);
    assert.equal(
      (
        await db.query<{ value: unknown }>("select purchase_upi_gateway_info($1,$2)as value", [
          user,
          order,
        ])
      ).rows[0].value,
      null,
    );

    const bind = (amount: number, expiry = "started_at+interval '50 minutes'") =>
      db.query(
        `select purchase_upi_gateway_bind($1,$2,$3,$4,$5,'second@bank','IndianXtrade',(select ${expiry} from upi_gateway_setups where order_id=$2),'upi://pay?pa=second%40bank&am=1490.50&cu=INR')`,
        [user, order, claim, token, amount],
      );
    await assert.rejects(bind(150000), /conflict/);
    await assert.rejects(bind(149050, "started_at+interval '51 minutes'"), /conflict/);
    assert.equal(
      (await db.query("select * from upi_gateway_setups where order_id=$1", [order])).rows.length,
      1,
    );
    await bind(149050);
    const bound = (
      await db.query<{
        value: {
          amount: number;
          base: number;
          upi: { amount: number; vpa: string; expiresAt: string };
        };
      }>("select purchase_read('order',$1,$2)as value", [user, order])
    ).rows[0].value;
    assert.equal(bound.amount, 149050);
    assert.equal(bound.upi.amount, bound.amount);
    assert.equal(bound.upi.vpa, "second@bank");
    assert.equal(
      (
        await db.query<{ discount_paise: number }>(
          "select discount_paise from orders where id=$1",
          [order],
        )
      ).rows[0].discount_paise,
      bound.base - bound.amount,
    );
    assert.equal(
      (await db.query("select * from upi_gateway_setups where order_id=$1", [order])).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from purchase_access")).rows.length,
      0,
      "binding alone cannot grant access",
    );

    // A student-supplied reference is private review data, never bank confirmation.
    const reference = "123456789012";
    const submitReference = (owner = user, value = reference) =>
      db.query("select purchase_upi_reference($1,$2,$3)", [owner, order, value]);
    await assert.rejects(submitReference(other), /Order not found/);
    await assert.rejects(submitReference(user, "<invalid>"), /Invalid payment reference/);
    await submitReference();
    const paymentDetails = async () =>
      (
        await db.query<{
          value: {
            status: string;
            couponDiscount: number;
            gatewaySavings: number;
            paymentReference: { reference: string; submittedAt: string };
          };
        }>("select purchase_read('order',$1,$2)as value", [user, order])
      ).rows[0].value;
    const submitted = await paymentDetails();
    assert.equal(submitted.status, "pending");
    assert.equal(submitted.gatewaySavings, 850);
    assert.equal(submitted.couponDiscount, 0);
    assert.equal(submitted.paymentReference.reference, reference);
    await submitReference();
    assert.equal(
      (await paymentDetails()).paymentReference.submittedAt,
      submitted.paymentReference.submittedAt,
    );
    await submitReference(user, "ABC123456789");
    assert.equal((await paymentDetails()).paymentReference.reference, "ABC123456789");
    assert.equal((await db.query("select * from purchase_access")).rows.length, 0);
    const review = (
      await db.query<{
        value: {
          items: {
            id: string;
            utr: string | null;
            submittedReference: string;
            reviewReason: string;
          }[];
        };
      }>("select academy_upi_payment_read('review','ABC123456789',0)as value")
    ).rows[0].value;
    assert.equal(review.items[0].id, order);
    assert.equal(review.items[0].utr, null);
    assert.equal(review.items[0].submittedReference, "ABC123456789");
    assert.match(review.items[0].reviewReason, /awaiting bank verification/);
    assert.equal(
      (
        await db.query<{ value: unknown }>("select purchase_read('order',$1,$2)as value", [
          other,
          order,
        ])
      ).rows[0].value,
      null,
    );
    await db.exec("set role authenticated");
    await assert.rejects(submitReference(), /permission denied/);
    await assert.rejects(db.exec("select * from purchase_payment_references"), /permission denied/);
    await db.exec("reset role");

    const unknownOrder = await create(other);
    assert.equal((await prepare(other, unknownOrder)).state, "create");
    await release(false, unknownOrder, other);
    const unknown = await prepare(other, unknownOrder);
    assert.equal(unknown.state, "unknown");
    assert.ok(unknown.retryAfter! > 3800);
    await db.query(
      "update upi_gateway_setups set started_at=clock_timestamp()-interval '66 minutes' where order_id=$1",
      [unknownOrder],
    );
    assert.equal(
      (await prepare(other, unknownOrder)).state,
      "create",
      "only the full safety window permits replacing an unknown attempt",
    );
    await db.query("select purchase_upi_gateway_save($1,$2,$3,$4)", [
      other,
      unknownOrder,
      claim,
      "z".repeat(32),
    ]);
    await release(false, unknownOrder, other);
    await db.query(
      "update upi_gateway_setups set started_at=clock_timestamp()-interval '66 minutes' where order_id=$1",
      [unknownOrder],
    );
    assert.equal(
      (await prepare(other, unknownOrder)).state,
      "resume",
      "a known token must be checked even after the safety window",
    );
    await db.query("select purchase_upi_gateway_abandon($1,$2,$3,$4)", [
      other,
      unknownOrder,
      claim,
      "z".repeat(32),
    ]);
    assert.equal(
      (await db.query<{ status: string }>("select status from orders where id=$1", [unknownOrder]))
        .rows[0].status,
      "cancelled",
    );

    for (const role of ["authenticated", "service_role"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.exec("select * from upi_gateway_setups"), /permission denied/);
      if (role === "authenticated") {
        await assert.rejects(prepare(), /permission denied/);
        await assert.rejects(save(), /permission denied/);
      }
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});
