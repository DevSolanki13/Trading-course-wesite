import { beforeEach, expect, it, vi } from "vitest";
import Dashboard from "../app/dashboard/page";
import { purchaseOrderCount } from "../backend/purchase/repository";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  catalog: vi.fn(),
  orders: vi.fn(),
  count: vi.fn(),
  announcements: vi.fn(),
}));
vi.mock("../backend/purchase/pages", () => ({ requirePurchaseUser: mocks.user }));
vi.mock("../backend/purchase/repository", () => ({
  purchaseCatalog: mocks.catalog,
  purchaseOrders: mocks.orders,
  purchaseOrderCount: mocks.count,
}));
vi.mock("../backend/purchase/mode", () => ({ localDemoEnabled: () => false }));
vi.mock("../backend/announcements/service", () => ({ listAnnouncements: mocks.announcements }));
vi.mock("../frontend/components/purchase-dashboard", () => ({ PurchaseDashboard: () => null }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "verified-owner", role: "student" });
  mocks.catalog.mockResolvedValue([{ id: "course", owned: true }]);
  mocks.orders.mockResolvedValue([{ id: "order" }]);
  mocks.count.mockResolvedValue(7);
  mocks.announcements.mockResolvedValue([]);
});

it.each(["courses", "explore", "account", "profile", "devices"])(
  "defers private history for %s while preserving the exact badge count",
  async (view) => {
    const result = await Dashboard({ searchParams: Promise.resolve({ view }) });
    expect(mocks.orders).not.toHaveBeenCalled();
    expect(purchaseOrderCount).toHaveBeenCalledWith("verified-owner");
    expect(result.props.orders).toEqual([]);
    expect(result.props.orderCount).toBe(7);
    expect(result.props.ordersFresh).toBe(false);
    expect(result.props.initialView).toBe(
      view === "profile" || view === "devices" ? "account" : view,
    );
  },
);

it.each(["billing", "orders"])(
  "loads full authoritative history for the %s deep link without an extra count query",
  async (view) => {
    const result = await Dashboard({ searchParams: Promise.resolve({ tab: view }) });
    expect(mocks.orders).toHaveBeenCalledWith("verified-owner");
    expect(mocks.count).not.toHaveBeenCalled();
    expect(result.props.ordersFresh).toBe(true);
    expect(result.props.orderCount).toBe(1);
    expect(result.props.initialView).toBe("billing");
  },
);

it("does no user-data reads when admission fails or an admin is redirected", async () => {
  mocks.user.mockRejectedValueOnce(new Error("Session revoked"));
  await expect(Dashboard({})).rejects.toThrow("Session revoked");
  mocks.user.mockResolvedValueOnce({ id: "admin", role: "admin" });
  await expect(Dashboard({})).rejects.toThrow("REDIRECT:/admin");
  expect(mocks.orders).not.toHaveBeenCalled();
  expect(mocks.count).not.toHaveBeenCalled();
  expect(mocks.catalog).not.toHaveBeenCalled();
});
