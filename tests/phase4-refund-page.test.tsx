import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { adminRequest } from "../backend/handlers/admin";
import { AuthError } from "../backend/auth/http";

const mocks = vi.hoisted(() => ({ privileged: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../backend/auth/session", () => ({ privileged: mocks.privileged, audit: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("LOCAL_DEMO", "false");
  mocks.privileged.mockResolvedValue({
    admin: { rpc: mocks.rpc },
    user: { id: "verified-staff" },
    sessionId: "verified-session",
  });
  mocks.rpc.mockResolvedValue({ data: { items: [], total: 55 }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

it("loads exactly one authorized refund-page RPC and preserves totals and private caching", async () => {
  const result = await adminRequest(
    new Request("http://localhost:3000/api/admin/refunds?state=approved&page=1"),
  );
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.privileged).toHaveBeenCalledWith(false);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("admin_refund_page_v2", {
    p_actor: "verified-staff",
    p_session: "verified-session",
    p_state: "approved",
    p_page: 1,
  });
  expect(await result.json()).toMatchObject({ items: [], total: 55 });
});

it("retains existing invalid-filter/page normalization without broadening input", async () => {
  await adminRequest(new Request("http://localhost:3000/api/admin/refunds?state=invalid&page=-1"));
  expect(mocks.rpc).toHaveBeenCalledWith(
    "admin_refund_page_v2",
    expect.objectContaining({ p_state: null, p_page: 0 }),
  );
});

it("does not read refund evidence before admission and does not mask database denial", async () => {
  mocks.privileged.mockRejectedValueOnce(new AuthError(403, "Denied"));
  expect((await adminRequest(new Request("http://localhost:3000/api/admin/refunds"))).status).toBe(
    403,
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
  expect((await adminRequest(new Request("http://localhost:3000/api/admin/refunds"))).status).toBe(
    403,
  );
});
