import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "../app/api/operations/run/route";

const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  gt: vi.fn(),
  select: vi.fn(),
  getUserById: vi.fn(),
  send: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../backend/database/supabase", () => ({
  createAdminClient: () => ({ ...m, auth: { admin: { getUserById: m.getUserById } } }),
}));
vi.mock("../backend/payments/cashfree", () => ({ cashfreeSandboxEnabled: () => false }));
vi.mock("../backend/payments/data", () => ({ commerceStore: vi.fn() }));
vi.mock("../backend/payments/workflow", () => ({
  reconcilePayment: vi.fn(),
  reconcileRefund: vi.fn(),
}));
vi.mock("../backend/notifications/delivery", () => ({ sendNotification: m.send }));

const secret = "receipt-worker-fixture-secret-longer-than-32";
const row = { id: "notice", user_id: "outbox-owner", attempts: 2, dedupe_key: "purchase:order" };
const request = (authorization = `Bearer ${secret}`) =>
  new Request("https://app.example/api/operations/run", { headers: { authorization } });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Network forbidden");
    }),
  );
  vi.stubEnv("OPERATIONS_ENABLED", "true");
  vi.stubEnv("PROJECT_STAGE", "staging");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("NOTIFICATION_DELIVERY_ENABLED", "true");
  vi.stubEnv("CRON_SECRET", secret);
  vi.stubEnv("RESEND_API_KEY", "fixture");
  vi.stubEnv("RESEND_FROM_EMAIL", "sender@example.invalid");
  m.rpc.mockImplementation(async (name) => ({
    error: null,
    data: name === "notification_claim" ? [row] : {},
  }));
  m.getUserById.mockResolvedValue({
    error: null,
    data: { user: { email_confirmed_at: "2026-01-01", email: "outbox-owner@example.invalid" } },
  });
  for (const fn of [m.from, m.update, m.eq, m.gt]) fn.mockReturnValue(m);
  m.select.mockResolvedValue({ error: null, data: [{ id: row.id }] });
  m.send.mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("keeps Vercel's daily config and supplies a minute external staging sweep", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  expect(config.crons).toContainEqual({ path: "/api/operations/run", schedule: "0 0 * * *" });
  const lines = readFileSync("backend/operations/staging-worker.crontab.example", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("#"));
  expect(lines).toEqual(['* * * * * cd "/srv/indianxtrade" && npm run operations:run -- --run']);
  const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
  expect(scripts["operations:run"]).toBe("node backend/scripts/run-operations.mjs");
});

it("delivers claimed receipts without a new checkout request and guards completion by attempt/lease", async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({ notifications: 1, accepted: 1, failed: 0 });
  expect(m.rpc).toHaveBeenCalledWith("notification_claim");
  expect(m.getUserById).toHaveBeenCalledWith(row.user_id);
  expect(m.send).toHaveBeenCalledWith(
    row,
    "outbox-owner@example.invalid",
    process.env,
    expect.any(Function),
  );
  expect(m.update).toHaveBeenCalledWith({ state: "sent", claimed_until: null });
  expect(m.eq).toHaveBeenCalledWith("id", row.id);
  expect(m.eq).toHaveBeenCalledWith("state", "sending");
  expect(m.eq).toHaveBeenCalledWith("attempts", row.attempts);
  expect(m.gt).toHaveBeenCalledWith("claimed_until", expect.any(String));
});

it.each([false, "throw", "unverified"])(
  "keeps failed worker deliveries retryable: %s",
  async (outcome) => {
    if (outcome === "throw") m.send.mockRejectedValue(new Error("provider unavailable"));
    else if (outcome === "unverified")
      m.getUserById.mockResolvedValue({ data: { user: { email: "student@example.invalid" } } });
    else m.send.mockResolvedValue(false);
    const start = Date.now();
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ accepted: 0, failed: 1 });
    const update = m.update.mock.calls[0][0];
    expect(update).toMatchObject({ state: "failed", claimed_until: null });
    expect(Date.parse(update.next_attempt_at)).toBeGreaterThanOrEqual(start + 1200000);
    if (outcome === "unverified") expect(m.send).not.toHaveBeenCalled();
  },
);

it("reports stale completion and claim failures for monitoring", async () => {
  m.select.mockResolvedValue({ data: [] });
  expect((await GET(request())).status).toBe(503);
  m.rpc.mockResolvedValue({ error: { message: "private details" } });
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Operations unavailable" });
});

it("preserves auth, environment and delivery opt-ins", async () => {
  expect((await GET(request("Bearer invalid"))).status).toBe(401);
  expect(m.rpc).not.toHaveBeenCalled();
  vi.stubEnv("VERCEL_ENV", "production");
  expect((await GET(request())).status).toBe(404);
  expect(m.rpc).not.toHaveBeenCalled();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("NOTIFICATION_DELIVERY_ENABLED", "false");
  expect((await GET(request())).status).toBe(200);
  expect(m.rpc).not.toHaveBeenCalledWith("notification_claim");
  expect(m.send).not.toHaveBeenCalled();
});
