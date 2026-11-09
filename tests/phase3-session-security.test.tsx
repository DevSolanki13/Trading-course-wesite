import { beforeEach, expect, it, vi } from "vitest";
import { admitted, identity, privileged } from "../backend/auth/session";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
  update: vi.fn(),
  lt: vi.fn(),
  cookie: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }) }));
vi.mock("../backend/database/supabase", () => ({
  createRequestClient: async () => ({
    auth: { getUser: mocks.getUser, getSession: mocks.getSession },
  }),
  createAdminClient: () => mocks,
}));
const id = "11111111-1111-4111-8111-111111111111";
function token(changes = {}) {
  return `header.${Buffer.from(JSON.stringify({ sub: id, session_id: "22222222-2222-4222-8222-222222222222", exp: Math.floor(Date.now() / 1000) + 3600, aal: "aal1", ...changes })).toString("base64url")}.signature`;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookie.mockReturnValue(undefined);
  mocks.getUser.mockResolvedValue({
    data: { user: { id, email: "owner@example.com", email_confirmed_at: "2026-01-01" } },
    error: null,
  });
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: token() } } });
  mocks.from.mockReturnValue(mocks);
  mocks.select.mockReturnValue(mocks);
  mocks.eq.mockReturnValue(mocks);
  mocks.update.mockReturnValue(mocks);
  mocks.lt.mockResolvedValue({ error: null });
  mocks.single.mockResolvedValue({ data: { id, role: "student", blocked: false }, error: null });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
});

it("does not cache identity across independent calls outside a React render", async () => {
  await identity();
  mocks.single.mockResolvedValueOnce({ data: { id, role: "student", blocked: true }, error: null });
  await expect(identity()).rejects.toMatchObject({ code: "ACCOUNT_BLOCKED", status: 403 });
  expect(mocks.getUser).toHaveBeenCalledTimes(2);
});

it.each([{ exp: 1 }, { sub: "another-user" }, { session_id: "invalid" }])(
  "rejects invalid/expired verified-session associations: %j",
  async (changes) => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: token(changes) } } });
    await expect(identity()).rejects.toMatchObject({ status: 401 });
    expect(mocks.from).not.toHaveBeenCalled();
  },
);

it("still checks revocation and refuses to record activity for an ended session", async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  await expect(admitted()).rejects.toMatchObject({ code: "SESSION_REVOKED", status: 401 });
  expect(mocks.update).not.toHaveBeenCalled();
});

it("preserves the device-limit fence and the conditional five-minute activity touch", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
  mocks.maybeSingle.mockResolvedValueOnce({
    data: {
      revoked_at: null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      admitted_at: null,
    },
    error: null,
  });
  await expect(admitted()).rejects.toMatchObject({ code: "DEVICE_LIMIT", status: 409 });
  await admitted();
  expect(mocks.update).toHaveBeenCalledWith({ last_active_at: expect.any(String) });
  expect(mocks.lt).toHaveBeenCalledWith("last_active_at", expect.any(String));
});

it("retains role and MFA checks even with a verified server identity", async () => {
  await expect(privileged()).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  mocks.single.mockResolvedValue({ data: { id, role: "admin", blocked: false }, error: null });
  await expect(privileged()).rejects.toMatchObject({ code: "MFA_REQUIRED", status: 403 });
  mocks.getSession.mockResolvedValueOnce({
    data: { session: { access_token: token({ aal: "aal2" }) } },
  });
  await expect(privileged(true)).resolves.toMatchObject({
    profile: { role: "admin" },
    aal: "aal2",
  });
});
