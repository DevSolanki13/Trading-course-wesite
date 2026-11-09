import { beforeEach, expect, it, vi } from "vitest";
import { purchaseRequest } from "../backend/handlers/purchase";
const m = vi.hoisted(() => ({ page: vi.fn(), orders: vi.fn(), user: vi.fn(), limit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../backend/purchase/repository", () => ({
  purchaseOrdersPage: m.page,
  purchaseOrders: m.orders,
}));
vi.mock("../backend/purchase/session", () => ({ purchaseUser: m.user }));
vi.mock("../backend/purchase/mode", () => ({ localDemoEnabled: () => false }));
vi.mock("../backend/purchase/service", () => ({}));
vi.mock("../backend/purchase/mail", () => ({}));
vi.mock("../backend/auth/http", async (original) => ({
  ...(await original<typeof import("../backend/auth/http")>()),
  limit: m.limit,
}));
beforeEach(() => {
  vi.clearAllMocks();
  m.user.mockResolvedValue({ id: "verified-owner" });
  m.page.mockResolvedValue({ orders: [], totalCount: 123 });
  m.orders.mockResolvedValue([{ id: "compatibility" }]);
});
it("uses verified owner and validated bounded cursor/filter contract, preserving private response headers", async () => {
  const cursor = {
    id: "30000000-0000-4000-8000-000000000001",
    createdAt: "2026-11-09T10:00:00.123456+00:00",
  };
  const params = new URLSearchParams({
    limit: "17",
    cursor: JSON.stringify(cursor),
    pendingCursor: JSON.stringify(cursor),
    status: "refunded",
    provider: "upi",
    pending: "1",
    userId: "attacker",
  });
  const result = await purchaseRequest(
    new Request(`https://example.invalid/api/purchase/orders?${params}`),
  );
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(m.page).toHaveBeenCalledWith("verified-owner", {
    limit: 17,
    cursor,
    pendingCursor: cursor,
    status: "refunded",
    provider: "upi",
    pendingOnly: true,
  });
  expect(m.orders).not.toHaveBeenCalled();
  expect(m.limit).toHaveBeenCalledWith(
    expect.any(Request),
    "billing-history",
    "verified-owner",
    30,
    60,
  );
});
it.each([
  "limit=0",
  "limit=51",
  "status=bogus",
  "provider=bogus",
  "cursor=bad",
  "pendingCursor=%7B%7D",
  "pending=bad",
])("rejects invalid history input %s before database access", async (query) => {
  const result = await purchaseRequest(
    new Request(`https://example.invalid/api/purchase/orders?${query}`),
  );
  expect(result.status).toBe(400);
  expect(m.page).not.toHaveBeenCalled();
  expect(m.orders).not.toHaveBeenCalled();
});
it("retains the no-query compatibility response", async () => {
  const result = await purchaseRequest(new Request("https://example.invalid/api/purchase/orders"));
  expect(await result.json()).toEqual({ orders: [{ id: "compatibility" }] });
  expect(m.page).not.toHaveBeenCalled();
});
it("rejects failed admission before reading any history", async () => {
  m.user.mockRejectedValueOnce(new Error("session revoked"));
  const result = await purchaseRequest(
    new Request("https://example.invalid/api/purchase/orders?limit=20"),
  );
  expect(result.ok).toBe(false);
  expect(m.page).not.toHaveBeenCalled();
});
