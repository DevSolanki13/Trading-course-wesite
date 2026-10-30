import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CashfreeClient,
  cashfreeSandboxEnabled,
  paise,
  webhookReference,
  type Purchase,
} from "../backend/payments/cashfree.ts";
import {
  reconcilePayment,
  reconcileRefund,
  type CommerceStore,
  type PaymentConfirmation,
} from "../backend/payments/workflow.ts";
import { operationsAuthorized } from "../backend/operations/policy.ts";
import { sendNotification } from "../backend/notifications/delivery.ts";

const env = {
  PAYMENT_MODE: "cashfree-sandbox",
  PROJECT_STAGE: "local",
  CASHFREE_ENV: "sandbox",
  CASHFREE_CLIENT_ID: "fixture-id",
  CASHFREE_CLIENT_SECRET: "fixture-secret",
  CASHFREE_API_VERSION: "2026-01-01",
};
const order: Purchase = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  provider_order_id: "cf_sbx_11111111111141118111111111111111",
  total_paise: 12345,
  status: "paid",
  created_at: new Date().toISOString(),
  billing_snapshot: {
    customer_email: "fixture@example.invalid",
    customer_phone: "9876543210",
    customer_name: "Fixture",
  },
};
const remote = () => ({
  order_id: order.provider_order_id,
  order_amount: 123.45,
  order_currency: "INR",
  order_status: "PAID",
  payment_session_id: "fixture-session",
  customer_details: { customer_id: order.user_id },
});
const payment = (status = "SUCCESS") => ({
  order_id: order.provider_order_id,
  cf_payment_id: "12345",
  payment_amount: 123.45,
  payment_currency: "INR",
  payment_status: status,
  payment_completion_time: new Date().toISOString(),
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
function storeFixture() {
  const payments: PaymentConfirmation[] = [];
  const states: string[] = [];
  let state = "approved";
  const store: CommerceStore = {
    order: async () => order,
    payment: async (value) => {
      payments.push(value);
    },
    terminal: async (_, value) => {
      states.push(value);
    },
    refund: async (reference) => ({
      id: "33333333-3333-4333-8333-333333333333",
      order_id: order.id,
      provider_reference: reference,
      state,
    }),
    refundState: async (_, __, ___, value) => {
      states.push(value);
      if (value === "PENDING") state = "processing";
    },
  };
  return { store, payments, states };
}
test("sandbox adapter fails closed, preserves integer paise and uses stable API idempotency", async () => {
  assert.equal(cashfreeSandboxEnabled(env), true);
  for (const overrides of [
    { PROJECT_STAGE: "production" },
    { VERCEL_ENV: "production" },
    { CASHFREE_ENV: "production" },
    { PAYMENT_MODE: "cashfree" },
    { CASHFREE_CLIENT_SECRET: "replace-me" },
  ])
    assert.equal(cashfreeSandboxEnabled({ ...env, ...overrides }), false);
  assert.equal(paise(123.45), 12345);
  assert.throws(() => paise(1.001));
  let calls = 0;
  const client = new CashfreeClient(env, async (input, init) => {
    calls++;
    assert.equal(String(input), "https://sandbox.cashfree.com/pg/orders");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("x-idempotency-key"), order.id);
    assert.equal(headers.get("x-api-version"), "2026-01-01");
    assert.equal(init?.redirect, "error");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.order_amount, 123.45);
    assert.equal(body.customer_details.customer_id, order.user_id);
    assert.equal(
      body.order_meta.return_url,
      `https://staging.example.invalid/checkout/status/${order.id}`,
    );
    return json({ ...remote(), order_status: "ACTIVE" });
  });
  await client.createOrder(order, "https://staging.example.invalid");
  await client.createOrder(order, "https://staging.example.invalid");
  assert.equal(calls, 2);
  const resumed = new CashfreeClient(env, async (_, init) =>
    init?.method === "POST" ? json({}, 409) : json(remote()),
  );
  assert.equal(
    (await resumed.createOrder(order, "https://staging.example.invalid")).order_id,
    order.provider_order_id,
  );
  await assert.rejects(
    client.createOrder(
      { ...order, billing_snapshot: { ...order.billing_snapshot, customer_phone: "invalid" } },
      "https://staging.example.invalid",
    ),
  );
  const bad = new CashfreeClient(env, async () => json({ ...remote(), order_amount: 123.44 }));
  await assert.rejects(bad.createOrder(order, "https://staging.example.invalid"), /MISMATCH/);
  const error = new CashfreeClient(env, async () =>
    json({ message: "private-provider-error" }, 429),
  );
  await assert.rejects(
    error.getOrder(order.provider_order_id),
    (value: Error) => value.message === "CASHFREE_HTTP_429",
  );
});
test("canonical reconciliation accepts failed-then-success attempts and rejects mismatched or incomplete confirmation", async () => {
  const f = storeFixture();
  const client = new CashfreeClient(env, async (input) =>
    json(
      String(input).endsWith("/payments")
        ? [{ ...payment("FAILED"), cf_payment_id: "failed-attempt" }, payment()]
        : remote(),
    ),
  );
  assert.equal(await reconcilePayment(client, f.store, order.provider_order_id), "paid");
  assert.deepEqual(
    f.payments.map((x) => x.status),
    ["FAILED", "SUCCESS"],
  );
  for (const value of [
    { ...payment(), payment_amount: 123.44 },
    { ...payment(), payment_currency: "USD" },
    { ...payment(), payment_completion_time: null },
  ]) {
    const next = storeFixture();
    const mismatch = new CashfreeClient(env, async (input) =>
      json(String(input).endsWith("/payments") ? [value] : remote()),
    );
    await assert.rejects(reconcilePayment(mismatch, next.store, order.provider_order_id));
    assert.equal(next.payments.length, 0);
  }
  const next = storeFixture();
  const wrongCustomer = new CashfreeClient(env, async () =>
    json({ ...remote(), customer_details: { customer_id: order.id } }),
  );
  await assert.rejects(
    reconcilePayment(wrongCustomer, next.store, order.provider_order_id),
    /MISMATCH/,
  );
  assert.equal(next.payments.length, 0);
  const notPaid = new CashfreeClient(env, async (input) =>
    json(
      String(input).endsWith("/payments") ? [payment()] : { ...remote(), order_status: "ACTIVE" },
    ),
  );
  await assert.rejects(
    reconcilePayment(notPaid, next.store, order.provider_order_id),
    /CONFIRMATION_PENDING/,
  );
  assert.equal(next.payments.length, 0);
  const failed = storeFixture();
  const expired = new CashfreeClient(env, async (input) =>
    json(
      String(input).endsWith("/payments")
        ? [payment("FAILED")]
        : { ...remote(), order_status: "EXPIRED" },
    ),
  );
  assert.equal(await reconcilePayment(expired, failed.store, order.provider_order_id), "closed");
  assert.deepEqual(failed.states, ["failed"]);
});
test("ambiguous refund timeout preserves reference and checks provider before retry; mismatched refunds cannot revoke access", async () => {
  const reference = "refund_33333333333343338333333333333333";
  const f = storeFixture();
  let posts = 0,
    exists = false;
  const client = new CashfreeClient(env, async (_, init) => {
    if (init?.method === "POST") {
      posts++;
      exists = true;
      assert.equal(JSON.parse(String(init.body)).refund_id, reference);
      throw new Error("timeout after acceptance");
    }
    return exists
      ? json({
          order_id: order.provider_order_id,
          refund_id: reference,
          refund_amount: 123.45,
          refund_currency: "INR",
          refund_status: "SUCCESS",
        })
      : json({}, 404);
  });
  await assert.rejects(reconcileRefund(client, f.store, order.provider_order_id, reference, true));
  assert.deepEqual(f.states, ["PENDING"]);
  assert.equal(
    await reconcileRefund(client, f.store, order.provider_order_id, reference, true),
    "refunded",
  );
  assert.equal(posts, 1);
  assert.deepEqual(f.states, ["PENDING", "SUCCESS"]);
  const wrong = storeFixture();
  const bad = new CashfreeClient(env, async () =>
    json({
      order_id: order.provider_order_id,
      refund_id: reference,
      refund_amount: 12.34,
      refund_currency: "INR",
      refund_status: "SUCCESS",
    }),
  );
  await assert.rejects(
    reconcileRefund(bad, wrong.store, order.provider_order_id, reference),
    /MISMATCH/,
  );
  assert.equal(wrong.states.length, 0);
});
test("webhooks extract scoped references and scheduler authorization refuses missing/weak/production tokens", () => {
  assert.deepEqual(
    webhookReference({
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: { order: { order_id: order.provider_order_id } },
    }),
    { orderId: order.provider_order_id },
  );
  assert.throws(() =>
    webhookReference({
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: { order: { order_id: "live_order" } },
    }),
  );
  assert.equal(webhookReference({ type: "UNSUPPORTED_EVENT", data: {} }), null);
  const secret = "fixture-operations-secret-of-at-least-32-characters";
  const ops = { OPERATIONS_ENABLED: "true", PROJECT_STAGE: "staging", CRON_SECRET: secret };
  assert.equal(operationsAuthorized(`Bearer ${secret}`, ops), true);
  for (const value of [null, "Bearer wrong", `bearer ${secret}`])
    assert.equal(operationsAuthorized(value, ops), false);
  assert.equal(
    operationsAuthorized(`Bearer ${secret}`, { ...ops, VERCEL_ENV: "production" }),
    false,
  );
  assert.equal(
    operationsAuthorized("Bearer change-me", { ...ops, CRON_SECRET: "change-me" }),
    false,
  );
});
test("transactional email delivery rejects expired claims and safely reports provider failure", async () => {
  const row = {
    id: order.id,
    dedupe_key: `purchase:${order.id}`,
    subject: "Confirmed",
    body: "Open your learning space",
    attempts: 1,
    claimed_until: new Date(Date.now() + 300000).toISOString(),
    delivery_started_at: new Date().toISOString(),
  };
  const sender = { RESEND_API_KEY: "fixture-key", RESEND_FROM_EMAIL: "sender@example.invalid" };
  let calls = 0;
  const fetcher: typeof fetch = async (_, init) => {
    calls++;
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), row.dedupe_key);
    return json({}, 503);
  };
  assert.equal(
    await sendNotification(
      { ...row, claimed_until: new Date(0).toISOString() },
      "fixture@example.invalid",
      sender,
      fetcher,
    ),
    false,
  );
  assert.equal(calls, 0);
  assert.equal(
    await sendNotification(
      { ...row, delivery_started_at: new Date(Date.now() - 24 * 3600000).toISOString() },
      "fixture@example.invalid",
      sender,
      fetcher,
    ),
    false,
  );
  assert.equal(calls, 0);
  assert.equal(await sendNotification(row, "fixture@example.invalid", sender, fetcher), false);
  assert.equal(calls, 1);
});
