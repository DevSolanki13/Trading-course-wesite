import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  getPaymentProvider,
  MockPaymentProvider,
  RealPaymentProvider,
  PaymentsUnavailableError,
  mockPaymentsAllowed,
} from "../backend/payments/providers.ts";
import { localDemoEnabled } from "../backend/purchase/mode.ts";
test("provider factory has a zero-env mock and refuses implicit production mock", () => {
  assert.ok(getPaymentProvider({}) instanceof MockPaymentProvider);
  assert.ok(
    getPaymentProvider({ NODE_ENV: "development", PAYMENT_PROVIDER: "razorpay" }) instanceof
      MockPaymentProvider,
  );
  assert.throws(() => getPaymentProvider({ NODE_ENV: "production" }), PaymentsUnavailableError);
  assert.ok(
    getPaymentProvider({ NODE_ENV: "production", ALLOW_MOCK_PAYMENTS: "true" }) instanceof
      MockPaymentProvider,
  );
  const env = {
    NODE_ENV: "production",
    PAYMENT_PROVIDER: "razorpay",
    RAZORPAY_KEY_ID: "rzp_test_fixture",
    RAZORPAY_KEY_SECRET: "fixture-secret",
  };
  assert.ok(getPaymentProvider(env) instanceof RealPaymentProvider);
  assert.equal(mockPaymentsAllowed(env), false);
  assert.equal(localDemoEnabled({ NODE_ENV: "production" }), false);
  assert.equal(localDemoEnabled({ NODE_ENV: "development" }), true);
  assert.equal(
    localDemoEnabled({
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: "https://configured.example",
    }),
    false,
  );
});
test("Razorpay requires the original signature and captured matching payment", async () => {
  const secret = "fixture-secret";
  let requests = 0;
  const factory = (status = "captured", overrides = {}) =>
    new RealPaymentProvider(
      {
        RAZORPAY_KEY_ID: "rzp_test_fixture",
        RAZORPAY_KEY_SECRET: secret,
        RAZORPAY_WEBHOOK_SECRET: "webhook-fixture",
      },
      async (input, init) => {
        requests++;
        assert.equal(String(input), "https://api.razorpay.com/v1/payments/pay_fixture");
        assert.equal(init?.redirect, "error");
        return Response.json({
          id: "pay_fixture",
          order_id: "order_fixture",
          amount: 10000,
          currency: "INR",
          status,
          ...overrides,
        });
      },
    );
  const p = {
    razorpay_order_id: "order_fixture",
    razorpay_payment_id: "pay_fixture",
    razorpay_signature: createHmac("sha256", secret)
      .update("order_fixture|pay_fixture")
      .digest("hex"),
  };
  assert.equal((await factory().verifyPayment(p)).status, "paid");
  const before = requests;
  await assert.rejects(
    factory().verifyPayment({ ...p, razorpay_signature: "0".repeat(64) }),
    /signature/,
  );
  assert.equal(requests, before);
  await assert.rejects(factory("authorized").verifyPayment(p), /awaiting capture/);
  await assert.rejects(
    factory("captured", { order_id: "order_other" }).verifyPayment(p),
    /mismatch/,
  );
  const raw = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_fixture" } } },
  });
  const request = (body = raw) =>
    new Request("https://app.example/api/webhooks/razorpay", {
      method: "POST",
      headers: {
        "x-razorpay-signature": createHmac("sha256", "webhook-fixture").update(raw).digest("hex"),
      },
      body,
    });
  assert.equal((await factory().handleWebhook(request()))?.providerPaymentId, "pay_fixture");
  await assert.rejects(factory().handleWebhook(request(raw + " ")), /signature/);
  const refundBody = JSON.stringify({
    event: "refund.processed",
    payload: { refund: { entity: { payment_id: "pay_fixture" } } },
  });
  const refundRequest = new Request("https://app.example/api/webhooks/razorpay", {
    method: "POST",
    headers: {
      "x-razorpay-signature": createHmac("sha256", "webhook-fixture")
        .update(refundBody)
        .digest("hex"),
    },
    body: refundBody,
  });
  assert.equal(
    (await factory("refunded", { amount_refunded: 10000 }).handleWebhook(refundRequest))?.status,
    "refunded",
  );
});
test("Razorpay order retry recovers the saved receipt instead of creating a second provider order", async () => {
  const input = {
    userId: "11111111-1111-4111-8111-111111111111",
    courseId: "22222222-2222-4222-8222-222222222222",
    receiptId: "33333333-3333-4333-8333-333333333333",
    amount: 10000,
    currency: "INR" as const,
  };
  let created = false,
    posts = 0;
  const provider = new RealPaymentProvider(
    { RAZORPAY_KEY_ID: "fixture", RAZORPAY_KEY_SECRET: "secret" },
    async (_, init) => {
      const row = {
        id: "order_fixture",
        amount: input.amount,
        currency: "INR",
        receipt: input.receiptId,
        notes: { userId: input.userId, courseId: input.courseId },
      };
      if (init?.method === "POST") {
        posts++;
        created = true;
        return Response.json(row);
      }
      return Response.json({ items: created ? [row] : [] });
    },
  );
  assert.equal((await provider.createOrder(input)).providerOrderId, "order_fixture");
  assert.equal((await provider.createOrder(input)).providerOrderId, "order_fixture");
  assert.equal(posts, 1);
});
