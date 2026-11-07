import { test } from "node:test";
import assert from "node:assert/strict";
import { IndianxtradeGateway, sharedUpiConfigured } from "../backend/payments/indianxtrade.ts";
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
  const result = await client.create(199900);
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
    await assert.rejects(client.create(199900));
  }
  const noNetwork = new IndianxtradeGateway(env, async () => {
    throw new Error("must not call");
  });
  await assert.rejects(noNetwork.create(100), /between INR 510/);
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
    "upi://pay?pa=shared%40bank&pn=IndianXtrade&am=1990.50&cu=INR",
    { width: 260 },
  );
  const client = new IndianxtradeGateway(
    env,
    async () => new Response(`<img src="${qr}"/><script>${qr}</script>`),
  );
  assert.equal((await client.checkoutIntent(token, 199900, Date.now())).amount, 199050);
});
