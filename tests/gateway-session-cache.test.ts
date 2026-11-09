import { test } from "node:test";
import assert from "node:assert/strict";
import { IndianxtradeGateway } from "../backend/payments/indianxtrade.ts";

const env = {
  UPI_GATEWAY: "indianxtrade",
  UPI_COLLECTION_VPA: "collector@bank",
  INDIANXTRADE_COLLECTOR_EMAIL: "collector@example.invalid",
  INDIANXTRADE_COLLECTOR_PASSWORD: "fixture-password-".repeat(4),
};
const token = "x".repeat(32);
const login = (cookie: string, extra = "") =>
  Response.json({}, { headers: { "set-cookie": `asm_session=${cookie}; HttpOnly${extra}` } });
const status = () => Response.json({ status: "PENDING_CONFIRMATION" });

test("concurrent gateway instances share a collector login and reuse it for subsequent requests", async () => {
  let logins = 0;
  const cookies: string[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    if (String(url).endsWith("/api/auth/login")) {
      logins++;
      return login("collector_one");
    }
    cookies.push(new Headers(init?.headers).get("Cookie")!);
    return status();
  };
  await Promise.all(
    Array.from({ length: 4 }, () => new IndianxtradeGateway(env, fetcher).status(token)),
  );
  await new IndianxtradeGateway(env, fetcher).status(token);
  assert.equal(logins, 1);
  assert.deepEqual(cookies, Array(5).fill("asm_session=collector_one"));
});

test("a delayed 401 for the old cookie reuses a newer session instead of logging in again", async () => {
  let oldCalls = 0;
  let logins = 0;
  let rejectOld!: (value: Response) => void;
  const fetcher: typeof fetch = async (url, init) => {
    if (String(url).endsWith("/api/auth/login")) {
      logins++;
      return login("refreshed_cookie");
    }
    const cookie = new Headers(init?.headers).get("Cookie");
    if (cookie === "asm_session=old_cookie") {
      if (++oldCalls === 1) return Response.json({}, { status: 401 });
      return new Promise<Response>((resolve) => {
        rejectOld = resolve;
      });
    }
    assert.equal(cookie, "asm_session=refreshed_cookie");
    return status();
  };
  const configured = { ...env, INDIANXTRADE_SESSION_TOKEN: "old_cookie" };
  const first = new IndianxtradeGateway(configured, fetcher).status(token);
  const second = new IndianxtradeGateway(configured, fetcher).status(token);
  await first;
  rejectOld(Response.json({}, { status: 401 }));
  await second;
  await new IndianxtradeGateway(configured, fetcher).status(token);
  assert.equal(logins, 1);
});

test("collector, password, supplied-session and collection-account changes are isolated", async () => {
  let logins = 0;
  const fetcher: typeof fetch = async (url, init) => {
    if (String(url).endsWith("/api/auth/login")) return login(`cookie_${++logins}`);
    assert.match(new Headers(init?.headers).get("Cookie")!, /^asm_session=cookie_/);
    return status();
  };
  const configurations = [
    env,
    { ...env, INDIANXTRADE_COLLECTOR_EMAIL: "other@example.invalid" },
    { ...env, INDIANXTRADE_COLLECTOR_PASSWORD: "rotated-password-".repeat(4) },
    { ...env, UPI_COLLECTION_VPA: "different@bank" },
  ];
  for (const configuration of configurations)
    await new IndianxtradeGateway(configuration, fetcher).status(token);
  await new IndianxtradeGateway(env, fetcher).status(token);
  assert.equal(logins, 4);
  await assert.rejects(
    new IndianxtradeGateway({ ...env, UPI_GATEWAY: "disabled" }, fetcher).status(token),
    /not configured/,
  );
  assert.equal(logins, 4, "an enabled collector's cache must not bypass disabled configuration");
  // Different supplied cookies must not share a credential entry either.
  const sent: string[] = [];
  const transport: typeof fetch = async (_url, init) => {
    sent.push(new Headers(init?.headers).get("Cookie")!);
    return status();
  };
  for (const cookie of ["static_one", "static_two"])
    await new IndianxtradeGateway({ ...env, INDIANXTRADE_SESSION_TOKEN: cookie }, transport).status(
      token,
    );
  assert.deepEqual(sent, ["asm_session=static_one", "asm_session=static_two"]);
});

test("server cookie expiry and the conservative five-minute cap trigger fresh sign-in", async (t) => {
  let now = 1_800_000_000_000;
  t.mock.method(Date, "now", () => now);
  for (const attributes of ["; Max-Age=1", "; Max-Age=86400"]) {
    let logins = 0;
    const fetcher: typeof fetch = async (url) =>
      String(url).endsWith("/api/auth/login") ? login(`cookie_${++logins}`, attributes) : status();
    await new IndianxtradeGateway(env, fetcher).status(token);
    now += attributes.includes("86400") ? 300_001 : 1001;
    await new IndianxtradeGateway(env, fetcher).status(token);
    assert.equal(logins, 2);
  }
});

test("failed shared login is not retained, and another request can retry", async () => {
  let logins = 0;
  const fetcher: typeof fetch = async (url) => {
    if (String(url).endsWith("/api/auth/login"))
      return ++logins === 1 ? Response.json({}, { status: 503 }) : login("recovered");
    return status();
  };
  const results = await Promise.allSettled(
    Array.from({ length: 3 }, () => new IndianxtradeGateway(env, fetcher).status(token)),
  );
  assert.ok(results.every((result) => result.status === "rejected"));
  assert.equal(logins, 1);
  await new IndianxtradeGateway(env, fetcher).status(token);
  assert.equal(logins, 2);
});

test("repeated unauthorized responses have only one auth retry and do not retain the rejected cookie", async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (url) => {
    calls.push(String(url));
    return String(url).endsWith("/api/auth/login")
      ? login("still_rejected")
      : Response.json({}, { status: 401 });
  };
  const configured = { ...env, INDIANXTRADE_SESSION_TOKEN: "old_cookie" };
  await assert.rejects(new IndianxtradeGateway(configured, fetcher).status(token), /401/);
  assert.equal(calls.length, 3);
  await assert.rejects(new IndianxtradeGateway(configured, fetcher).status(token), /401/);
  assert.equal(calls.length, 7);
});

test("expired cookies fail closed, and transports do not share sessions", async () => {
  let calls = 0;
  const expired: typeof fetch = async () => {
    calls++;
    return login("expired", "; Max-Age=0");
  };
  await assert.rejects(new IndianxtradeGateway(env, expired).status(token), /expired session/);
  assert.equal(calls, 1);
  let logins = 0;
  for (let i = 0; i < 2; i++) {
    const fetcher: typeof fetch = async (url) =>
      String(url).endsWith("/api/auth/login") ? (logins++, login("fixture")) : status();
    await new IndianxtradeGateway(env, fetcher).status(token);
  }
  assert.equal(logins, 2);
});

test("collector cache is bounded across configuration rotations", async () => {
  let logins = 0;
  const fetcher: typeof fetch = async (url) =>
    String(url).endsWith("/api/auth/login") ? login(`cookie_${++logins}`) : status();
  for (let i = 0; i < 9; i++)
    await new IndianxtradeGateway(
      { ...env, INDIANXTRADE_COLLECTOR_EMAIL: `collector${i}@example.invalid` },
      fetcher,
    ).status(token);
  await new IndianxtradeGateway(
    { ...env, INDIANXTRADE_COLLECTOR_EMAIL: "collector0@example.invalid" },
    fetcher,
  ).status(token);
  assert.equal(logins, 10);
});
