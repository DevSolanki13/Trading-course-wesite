import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IndianxtradeGateway,
  sharedUpiConfigured,
  sharedCollectionVpas,
} from "../backend/payments/indianxtrade.ts";
import { GatewayError } from "../backend/payments/gateway-error.ts";
import { upiConfig } from "../backend/payments/upi-config.ts";
import { getCheckoutProvider, PaymentsUnavailableError } from "../backend/payments/providers.ts";

const env = {
  PAYMENT_PROVIDER: "upi",
  UPI_GATEWAY: "indianxtrade",
  UPI_COLLECTION_VPA: "shared@bank",
  INDIANXTRADE_COLLECTOR_EMAIL: "collector@example.invalid",
  INDIANXTRADE_COLLECTOR_PASSWORD: "a".repeat(48),
  INDIANXTRADE_SESSION_TOKEN: "t".repeat(43),
  UPI_PAYMENTS_ENABLED: "off",
  UPI_PILOT_USER_IDS: "pilot",
};
const token = "x".repeat(32);
test("shared-account checkout uses the unchanged IndianXtrade gateway, never Academy's separate bank-credit matcher", () => {
  assert.equal(sharedUpiConfigured(env), true);
  assert.equal(upiConfig(env).configured, true);
  assert.equal(upiConfig(env).relayEnabled, false);
  assert.equal(getCheckoutProvider(env, "pilot").name, "upi");
  assert.throws(() => getCheckoutProvider(env, "other"), PaymentsUnavailableError);
  assert.throws(
    () => getCheckoutProvider({ ...env, INDIANXTRADE_COLLECTOR_PASSWORD: "" }, "pilot"),
    PaymentsUnavailableError,
  );
});
test("shared gateway reserves through the existing allocator and binds only its validated exact QR amount", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const client = new IndianxtradeGateway(env, async (url, init) => {
    calls.push({ url: String(url), init });
    return calls.length === 1
      ? Response.json({ checkoutToken: token })
      : new Response(
          '<a href="upi://pay?pa=shared%40bank&amp;pn=IndianXtrade&amp;am=1990.50&amp;cu=INR">Pay</a>',
        );
  });
  const savedToken = await client.create(199900);
  assert.equal(savedToken, token);
  assert.equal(
    calls.length,
    1,
    "creation returns its reference before fetching or validating a QR",
  );
  const result = await client.checkoutIntent(savedToken, 199900, Date.now());
  assert.equal(result.amount, 199050);
  assert.equal(result.vpa, "shared@bank");
  assert.equal(result.token, token);
  assert.deepEqual(JSON.parse(calls[0].init!.body as string), { method: "UPI", amountInr: 198900 });
  assert.equal(calls[0].url, "https://indianxtrade.com/api/deposits");
  assert.equal(
    new Headers(calls[0].init!.headers).get("Cookie"),
    `asm_session=${env.INDIANXTRADE_SESSION_TOKEN}`,
  );
  assert.equal(calls[0].init!.redirect, "error");
  assert.equal(calls[1].url, `https://indianxtrade.com/checkout/${token}`);
});
test("shared gateway refuses overcharges, changed collection accounts, malformed pages and unsupported small totals", async () => {
  for (const link of [
    "upi://pay?pa=shared%40bank&am=2000.00&cu=INR",
    "upi://pay?pa=attacker%40bank&am=1990.50&cu=INR",
    "upi://pay?pa=shared%40bank&am=1990.505&cu=INR",
    "https://attacker.invalid",
  ]) {
    let calls = 0;
    const client = new IndianxtradeGateway(env, async () =>
      ++calls === 1
        ? Response.json({ checkoutToken: token })
        : new Response(`<a href="${link}">Pay</a>`),
    );
    await assert.rejects(client.checkoutIntent(await client.create(199900), 199900, Date.now()));
  }
  const noNetwork = new IndianxtradeGateway(env, async () => {
    throw new Error("must not call");
  });
  await assert.rejects(noNetwork.create(100), /between INR 510/);
});

test("only explicitly approved collection accounts are accepted, with compatible single-account configuration", async () => {
  const config = { ...env, UPI_COLLECTION_VPAS: " Shared@Bank, SECOND@bank,shared@bank " };
  assert.deepEqual(sharedCollectionVpas(config), ["shared@bank", "second@bank"]);
  assert.equal(sharedUpiConfigured({ ...env, UPI_COLLECTION_VPA: "  SHARED@BANK " }), true);
  for (const value of ["shared@bank,", "shared@bank,bad", ",", "upi://pay?pa=shared@bank"])
    assert.equal(sharedUpiConfigured({ ...config, UPI_COLLECTION_VPAS: value }), false);
  for (const vpa of ["shared@bank", "SECOND@BANK"]) {
    const client = new IndianxtradeGateway(
      config,
      async () =>
        new Response(`<a href="upi://pay?pa=${encodeURIComponent(vpa)}&am=1490.50&cu=INR">Pay</a>`),
    );
    assert.equal((await client.checkoutIntent(token, 149900, Date.now())).amount, 149050);
  }
  const client = new IndianxtradeGateway(
    config,
    async () => new Response('<a href="upi://pay?pa=unknown%40bank&am=1490.50&cu=INR">Pay</a>'),
  );
  await assert.rejects(client.checkoutIntent(token, 149900, Date.now()), (error: unknown) => {
    assert.ok(error instanceof GatewayError);
    assert.equal(error.code, "ACCOUNT_MISMATCH");
    assert.equal(JSON.stringify(error).includes("unknown@bank"), false);
    return true;
  });
});

test("coupon and minimum totals accept exactly the allocator range and reject malformed payment instructions", async () => {
  for (const [total, raw] of [
    [149900, "1479.01"],
    [149900, "1499.00"],
    [51000, "490.01"],
    [51000, "510.00"],
  ] as const) {
    const client = new IndianxtradeGateway(
      env,
      async () => new Response(`<a href="upi://pay?pa=shared%40bank&am=${raw}&cu=INR">Pay</a>`),
    );
    assert.equal(
      (await client.checkoutIntent(token, total, Date.now())).amount,
      Math.round(Number(raw) * 100),
    );
  }
  for (const [params, code] of [
    ["pa=shared%40bank&am=1479.00&cu=INR", "AMOUNT_MISMATCH"],
    ["pa=shared%40bank&am=1499.01&cu=INR", "AMOUNT_MISMATCH"],
    ["pa=shared%40bank&am=1490.5&cu=INR", "AMOUNT_FORMAT"],
    ["pa=shared%40bank&am=1490.50", "CURRENCY_MISMATCH"],
    ["pa=shared%40bank&am=1490.50&cu=USD", "CURRENCY_MISMATCH"],
    ["pa=shared%40bank&am=1490.50&am=1490.50&cu=INR", "UPI_PARAMETERS"],
    ["pa=shared%40bank&pa=other%40bank&am=1490.50&cu=INR", "UPI_PARAMETERS"],
  ]) {
    const client = new IndianxtradeGateway(
      env,
      async () => new Response(`<a href="upi://pay?${params}">Pay</a>`),
    );
    await assert.rejects(client.checkoutIntent(token, 149900, Date.now()), { code });
  }
});

test("retrying a QR uses its original deadline and refuses an expired reservation", async () => {
  const client = new IndianxtradeGateway(
    env,
    async () => new Response('<a href="upi://pay?pa=shared%40bank&am=1490.50&cu=INR">Pay</a>'),
  );
  const started = Date.now() - 20 * 60000;
  assert.equal(
    (await client.checkoutIntent(token, 149900, started)).expiresAt,
    new Date(started + 50 * 60000).toISOString(),
  );
  await assert.rejects(client.checkoutIntent(token, 149900, Date.now() - 51 * 60000), {
    code: "SETUP_EXPIRED",
  });
});

test("creation distinguishes definitive rejection from an ambiguous remote result and redacts transport errors", async () => {
  for (const [response, safe] of [
    [400, true],
    [429, true],
    [500, false],
    [408, false],
  ] as const) {
    const client = new IndianxtradeGateway(
      env,
      async () => new Response("upstream private data", { status: response }),
    );
    await assert.rejects(client.create(149900), {
      code: "GATEWAY_UNAVAILABLE",
      safeToRetryCreation: safe,
    });
  }
  const client = new IndianxtradeGateway(env, async () => {
    throw new Error(`secret ${token}`);
  });
  await assert.rejects(client.create(149900), (error: unknown) => {
    assert.ok(error instanceof GatewayError);
    assert.equal(error.safeToRetryCreation, false);
    assert.equal(JSON.stringify(error).includes(token), false);
    return true;
  });
  await assert.rejects(
    new IndianxtradeGateway(env, async () => new Response("malformed")).create(149900),
    { code: "GATEWAY_RESPONSE", safeToRetryCreation: false },
  );
});
test("only a completed owner-authenticated gateway deposit can count as paid; session expiry refreshes through the existing sign-in API", async () => {
  let calls = 0;
  const client = new IndianxtradeGateway(env, async (url, init) => {
    calls++;
    if (calls === 1) return Response.json({}, { status: 401 });
    if (calls === 2) {
      assert.equal(String(url), "https://indianxtrade.com/api/auth/login");
      return Response.json(
        { userId: "collector" },
        { headers: { "set-cookie": `asm_session=${"r".repeat(43)}; HttpOnly` } },
      );
    }
    assert.equal(new Headers(init?.headers).get("Cookie"), `asm_session=${"r".repeat(43)}`);
    return Response.json({ status: "COMPLETED", chainCredit: null });
  });
  assert.equal(await client.status(token), "COMPLETED");
  await assert.rejects(client.status("../../private"));
});

test("reads the existing gateway's PNG QR without requiring a payment link in its HTML", async () => {
  const { default: QRCode } = await import("qrcode");
  const qr = await QRCode.toDataURL(
    "upi://pay?pa=second%40bank&pn=IndianXtrade&am=1990.50&cu=INR",
    { width: 260 },
  );
  const client = new IndianxtradeGateway(
    { ...env, UPI_COLLECTION_VPAS: "shared@bank,second@bank" },
    async () => new Response(`<img src="${qr}"/><script>${qr}</script>`),
  );
  const intent = await client.checkoutIntent(token, 199900, Date.now());
  assert.equal(intent.amount, 199050);
  assert.equal(intent.vpa, "second@bank");
});
