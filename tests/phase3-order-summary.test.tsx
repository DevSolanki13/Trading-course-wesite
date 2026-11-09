import { beforeEach, expect, it, vi } from "vitest";
import { purchaseOrderCount } from "../backend/purchase/repository";

const mocks = vi.hoisted(() => ({
  local: false,
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  query: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../backend/database/supabase", () => ({ createAdminClient: () => mocks }));
vi.mock("../backend/purchase/mode.ts", () => ({ localDemoEnabled: () => mocks.local }));
vi.mock("../backend/local/database.ts", () => ({
  localDatabase: async () => ({ query: mocks.query }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.local = false;
  mocks.from.mockReturnValue(mocks);
  mocks.select.mockReturnValue(mocks);
  mocks.eq.mockResolvedValue({ count: 7, error: null });
});

it("counts every provider with an explicit verified-owner filter and no financial payload", async () => {
  expect(await purchaseOrderCount("owner-one")).toBe(7);
  expect(mocks.from).toHaveBeenCalledWith("orders");
  expect(mocks.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner-one");
  expect(await purchaseOrderCount("owner-two")).toBe(7);
  expect(mocks.eq).toHaveBeenLastCalledWith("user_id", "owner-two");
});

it("reports unavailable counts instead of silently claiming zero orders", async () => {
  mocks.eq.mockResolvedValue({ count: null, error: { message: "Unavailable" } });
  await expect(purchaseOrderCount("owner")).rejects.toThrow(
    "Billing summary is temporarily unavailable.",
  );
});

it("keeps local-demo counts owner scoped and read only", async () => {
  mocks.local = true;
  mocks.query.mockResolvedValue({ rows: [{ count: 4 }] });
  expect(await purchaseOrderCount("local-owner")).toBe(4);
  expect(mocks.query).toHaveBeenCalledWith(
    "select count(*)::integer as count from public.orders where user_id=$1",
    ["local-owner"],
  );
  expect(mocks.from).not.toHaveBeenCalled();
});
