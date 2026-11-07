import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { upiRelay } from "../backend/handlers/upi-relay";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../backend/purchase/repository", () => ({ purchaseRpc: rpc }));
vi.mock("../backend/auth/http", () => ({
  AuthError: class extends Error {},
  body: (request: Request) => request.json(),
  failure: () => Response.json({}, { status: 503 }),
  json: (value: unknown, status = 200) => Response.json(value, { status }),
  limit: vi.fn(),
}));
const secret = "operator-secret-".repeat(4);
const payload = {
  sender: "AX-HDFC",
  body: "A/c XX5678 credited INR 999.91 UTR: 123456789012",
  receivedAt: new Date().toISOString(),
};
const request = (data = payload, token = secret) =>
  new Request("https://academy.example/api/bank-feed/sms", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(data),
  });
beforeEach(() => {
  for (const [key, value] of Object.entries({
    PAYMENT_PROVIDER: "upi",
    UPI_PAYMENTS_ENABLED: "on",
    UPI_COLLECTION_VPA: "academy@bank",
    UPI_ACCOUNT_MARKERS: "XX5678",
    UPI_RELAY_SENDERS: "HDFC",
    SMS_RELAY_SECRET: secret,
  }))
    vi.stubEnv(key, value);
  rpc.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it("rejects an invalid operator secret before accessing the database", async () => {
  expect((await upiRelay(request(payload, "wrong"))).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
it("ignores another site's account even with a valid operator token", async () => {
  const response = await upiRelay(
    request({ ...payload, body: payload.body.replace("XX5678", "XX1234") }),
  );
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ accepted: true, matched: false });
  expect(rpc).not.toHaveBeenCalled();
});
it("stores the parsed bank amount and reference, then acknowledges confirmation", async () => {
  rpc.mockResolvedValue("saved-order");
  const response = await upiRelay(request());
  expect(response.status).toBe(202);
  expect(rpc).toHaveBeenCalledWith("purchase_upi_credit", {
    p_utr: "123456789012",
    p_amount: 99991,
    p_received: payload.receivedAt,
    p_sender: payload.sender,
    p_body: payload.body,
  });
  expect(await response.json()).toEqual({ accepted: true, matched: true });
});
it("returns a retryable error when the bank credit could not be stored", async () => {
  rpc.mockRejectedValue(new Error("database unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await upiRelay(request())).status).toBe(503);
  } finally {
    log.mockRestore();
  }
});
it("never grants access from a debit or a message without a usable reference", async () => {
  for (const body of [
    payload.body.replace("credited", "debited"),
    "A/c XX5678 credited INR 999.91",
  ])
    expect((await upiRelay(request({ ...payload, body }))).status).toBe(202);
  expect(rpc).not.toHaveBeenCalled();
});

it("confirms a pilot bank message while public checkout remains closed", async () => {
  vi.stubEnv("UPI_PAYMENTS_ENABLED", "off");
  vi.stubEnv("UPI_RELAY_ENABLED", "on");
  rpc.mockResolvedValue("pilot-order");
  const response = await upiRelay(request());
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ accepted: true, matched: true });
});
it("keeps bank messages retryable if both checkout and relay are disabled", async () => {
  vi.stubEnv("UPI_PAYMENTS_ENABLED", "off");
  vi.stubEnv("UPI_RELAY_ENABLED", "off");
  expect((await upiRelay(request())).status).toBe(503);
  expect(rpc).not.toHaveBeenCalled();
});
