import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { academyCreditMessage, upiConfig, upiLink } from "../backend/payments/upi-config.ts";
import {
  getPaymentProvider,
  getCheckoutProvider,
  PaymentsUnavailableError,
} from "../backend/payments/providers.ts";
import { parseBankSms } from "../backend/payments/parse-bank-sms.ts";

const env = {
  PAYMENT_PROVIDER: "upi",
  UPI_PAYMENTS_ENABLED: "on",
  UPI_COLLECTION_VPA: "academy@bank",
  UPI_ACCOUNT_MARKERS: "XX5678",
  UPI_RELAY_SENDERS: "HDFC",
  SMS_RELAY_SECRET: "a".repeat(48),
};
test("UPI fails closed, validates account routing, and cannot accept browser payment claims", async () => {
  assert.ok(upiConfig(env).enabled);
  for (const key of [
    "UPI_PAYMENTS_ENABLED",
    "UPI_COLLECTION_VPA",
    "UPI_ACCOUNT_MARKERS",
    "UPI_RELAY_SENDERS",
    "SMS_RELAY_SECRET",
  ])
    assert.throws(
      () => getPaymentProvider({ ...env, [key]: "", ALLOW_MOCK_PAYMENTS: "true" }),
      PaymentsUnavailableError,
    );
  assert.equal(academyCreditMessage("AX-HDFC", "XX1234 credited INR 100", env), false);
  assert.equal(academyCreditMessage("AX-HDFC", "XX5678 credited INR 100", env), true);
  assert.equal(academyCreditMessage("SPAM", "XX5678 credited INR 100", env), false);
  assert.equal(parseBankSms("A/c XX5678 credited INR 999.91 UTR: 123456789012")?.amountInr, 99991);
  assert.equal(parseBankSms("A/c XX5678 debited INR 999.91 UTR: 123456789012")?.isCredit, false);
  assert.match(upiLink("academy@bank", "Academy", 99991, "order"), /am=999.91/);
  await assert.rejects(getPaymentProvider(env).verifyPayment({ status: "paid" }), /bank relay/);
});

test("new Academy checkout allows only configured UPI, regardless of legacy provider flags", () => {
  assert.equal(getCheckoutProvider(env).name, "upi");
  for (const PAYMENT_PROVIDER of [undefined, "cashfree", "razorpay", "mock", "demo"]) {
    assert.throws(
      () =>
        getCheckoutProvider({
          ...env,
          PAYMENT_PROVIDER,
          PAYMENT_MODE: "cashfree-sandbox",
          ALLOW_MOCK_PAYMENTS: "true",
          ALLOW_TEST_PAYMENTS: "true",
          RAZORPAY_KEY_ID: "rzp_test_fixture",
          RAZORPAY_KEY_SECRET: "fixture-secret",
          CASHFREE_CLIENT_ID: "fixture-client",
          CASHFREE_CLIENT_SECRET: "fixture-secret",
        }),
      PaymentsUnavailableError,
    );
  }
  assert.throws(
    () => getCheckoutProvider({ ...env, UPI_PAYMENTS_ENABLED: "off" }),
    PaymentsUnavailableError,
  );
});

test("UPI reservations and bank confirmation are atomic, unique, immutable, owner-scoped and replay-safe", async () => {
  const db = new PGlite();
  const users = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}');
      create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
      create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt()returns jsonb language sql stable as $$select '{}'::jsonb$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
    const root = new URL("../backend/database/migrations/", import.meta.url);
    for (const file of (await readdir(root)).filter((f) => f.endsWith(".sql")).sort())
      await db.exec(await readFile(new URL(file, root), "utf8"));
    for (const user of users)
      await db.query("insert into auth.users(id,email)values($1,$2)", [
        user,
        `${user}@example.invalid`,
      ]);
    const course = (
      await db.query<{ id: string }>(
        "insert into courses(slug,title,price_paise,status)values('upi-fixture','UPI fixture',10000,'published')returning id",
      )
    ).rows[0].id;
    const create = async (user: string) =>
      (
        await db.query<{ id: string }>(
          "select purchase_create_order($1,$2,'upi','https://academy.example')as id",
          [user, course],
        )
      ).rows[0].id;
    const reserve = (user: string, order: string) =>
      db.query("select purchase_upi_reserve($1,$2,'academy@bank','Academy')", [user, order]);
    const first = await create(users[0]);
    const second = await create(users[1]);
    await assert.rejects(reserve(users[1], first), /Invalid UPI order/);
    await reserve(users[0], first);
    await reserve(users[1], second);
    await reserve(users[0], first);
    const intents = (
      await db.query<{ order_id: string; amount_paise: number }>(
        "select * from upi_intents order by amount_paise desc",
      )
    ).rows;
    assert.deepEqual(
      intents.map((i) => i.amount_paise),
      [10000, 9999],
    );
    assert.equal(intents[0].order_id, first);
    const read = (
      await db.query<{ result: { upi: { amount: number } } }>(
        "select purchase_read('order',$1,$2)as result",
        [users[1], second],
      )
    ).rows[0].result;
    assert.equal(read.upi.amount, 9999);
    assert.equal(
      (
        await db.query<{ result: unknown }>("select purchase_read('order',$1,$2)as result", [
          users[1],
          first,
        ])
      ).rows[0].result,
      null,
    );
    await assert.rejects(
      db.query("select purchase_create_order($1,$2,'upi','https://academy.example','DIFFERENT')", [
        users[0],
        course,
      ]),
      /different coupon/,
    );
    const credit = (utr: string, amount: number, received = new Date().toISOString()) =>
      db.query<{ id: string | null }>(
        "select purchase_upi_credit($1,$2,$3,'AX-HDFC','fixture')as id",
        [utr, amount, received],
      );
    await assert.rejects(
      credit("123456789010", 10000, new Date(Date.now() - 8 * 86400000).toISOString()),
      /Invalid bank credit/,
    );
    assert.equal(
      (await credit("123456789009", 10000, new Date(Date.now() - 60000).toISOString())).rows[0].id,
      null,
    );
    assert.equal((await credit("123456789011", 12345)).rows[0].id, null);
    await db.exec(
      "create function fixture_fail()returns trigger language plpgsql as $$begin raise exception 'grant failure';end;$$;create trigger fixture_fail before insert on enrollments for each row execute function fixture_fail()",
    );
    await assert.rejects(credit("123456789012", 10000), /grant failure/);
    assert.equal(
      (await db.query("select * from upi_credits where utr='123456789012'")).rows.length,
      0,
    );
    await db.exec("drop trigger fixture_fail on enrollments");
    assert.equal((await credit("123456789012", 10000)).rows[0].id, first);
    assert.equal((await credit("123456789012", 10000)).rows[0].id, first);
    await assert.rejects(credit("123456789012", 9999), /Reference reused/);
    assert.equal((await db.query("select * from enrollments where active")).rows.length, 1);
    assert.equal(
      (
        await db.query<{ allowed: boolean }>("select purchase_has_access($1,$2)as allowed", [
          users[0],
          course,
        ])
      ).rows[0].allowed,
      true,
    );
    assert.equal(
      (
        await db.query<{ allowed: boolean }>("select purchase_has_access($1,$2)as allowed", [
          users[1],
          course,
        ])
      ).rows[0].allowed,
      false,
    );
    await db.query(
      "update upi_intents set expires_at=clock_timestamp()-interval '1 second'where order_id=$1",
      [second],
    );
    assert.equal((await credit("123456789013", 9999)).rows[0].id, null);
    const replacement = await create(users[1]);
    assert.notEqual(replacement, second);
    await reserve(users[1], replacement);
    assert.equal(
      (
        await db.query<{ amount_paise: number }>(
          "select amount_paise from upi_intents where order_id=$1",
          [replacement],
        )
      ).rows[0].amount_paise,
      9998,
    );
    const sharedCourse = (
      await db.query<{ id: string }>(
        "insert into courses(slug,title,price_paise,status)values('shared-upi-fixture','Shared UPI fixture',199900,'published')returning id",
      )
    ).rows[0].id;
    const sharedOrder = (
      await db.query<{ id: string }>(
        "select purchase_create_order($1,$2,'upi','https://academy.example')as id",
        [users[1], sharedCourse],
      )
    ).rows[0].id;
    const sharedClaim = "33333333-3333-4333-8333-333333333333";
    await db.query("select purchase_claim_creation($1,$2,$3)", [
      users[1],
      sharedOrder,
      sharedClaim,
    ]);
    const sharedToken = "s".repeat(32);
    const bind = (amount: number) =>
      db.query(
        "select purchase_upi_gateway_bind($1,$2,$3,$4,$5,'shared@bank','IndianXtrade',clock_timestamp()+interval '50 minutes')",
        [users[1], sharedOrder, sharedClaim, sharedToken, amount],
      );
    await assert.rejects(bind(200000), /Shared payment setup conflict/);
    await bind(199050);
    const sharedInfo = (
      await db.query<{ info: { token: string; amount: number } }>(
        "select purchase_upi_gateway_info($1,$2)as info",
        [users[1], sharedOrder],
      )
    ).rows[0].info;
    assert.deepEqual(sharedInfo, { token: sharedToken, amount: 199050 });
    assert.equal(
      (
        await db.query<{ info: unknown }>("select purchase_upi_gateway_info($1,$2)as info", [
          users[0],
          sharedOrder,
        ])
      ).rows[0].info,
      null,
    );
    const clientOrder = (
      await db.query<{ result: { upi: { gateway: string } } }>(
        "select purchase_read('order',$1,$2)as result",
        [users[1], sharedOrder],
      )
    ).rows[0].result;
    assert.equal(clientOrder.upi.gateway, "indianxtrade");
    assert.equal(JSON.stringify(clientOrder).includes(sharedToken), false);
    assert.equal(
      (await credit("123456789014", 199050)).rows[0].id,
      null,
      "Shared gateway purchase cannot be settled by Academy SMS",
    );
    await db.query("select purchase_settle($1)", [
      JSON.stringify({
        provider: "upi",
        providerOrderId: `upi_${sharedOrder}`,
        providerPaymentId: `upi_indianxtrade_${sharedToken}`,
        amount: 199050,
        currency: "INR",
        status: "paid",
      }),
    ]);
    assert.equal(
      (
        await db.query<{ allowed: boolean }>("select purchase_has_access($1,$2)as allowed", [
          users[1],
          sharedCourse,
        ])
      ).rows[0].allowed,
      true,
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      db.exec("select purchase_upi_credit('123456789099',9998,now(),'x','x')"),
      /permission denied/,
    );
    await assert.rejects(db.exec("select * from upi_credits"), /permission denied/);
  } finally {
    await db.close();
  }
});

test("pilot checkout is session-scoped and relay ingestion stays available while public checkout is closed", () => {
  const pilot = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const testing = {
    ...env,
    UPI_PAYMENTS_ENABLED: "off",
    UPI_RELAY_ENABLED: "on",
    UPI_PILOT_USER_IDS: pilot,
  };
  assert.equal(upiConfig(testing).enabled, false);
  assert.equal(upiConfig(testing).relayEnabled, true);
  assert.equal(getCheckoutProvider(testing, pilot).name, "upi");
  for (const id of [undefined, other])
    assert.throws(() => getCheckoutProvider(testing, id), PaymentsUnavailableError);
  assert.throws(
    () => getCheckoutProvider({ ...testing, UPI_RELAY_ENABLED: "off" }, pilot),
    PaymentsUnavailableError,
  );
  assert.throws(
    () => getCheckoutProvider({ ...testing, UPI_COLLECTION_VPA: "" }, pilot),
    PaymentsUnavailableError,
  );
  assert.equal(upiConfig({ ...env, UPI_RELAY_ENABLED: "off" }).relayEnabled, true);
});
