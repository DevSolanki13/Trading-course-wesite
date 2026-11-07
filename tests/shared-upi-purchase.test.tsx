import { afterEach, expect, it, vi } from "vitest";
import { createPurchase } from "../backend/purchase/service";
import type { PurchaseUser } from "../shared/purchase";
const { rpc, read, orders, quote, course, bind, reconcile } = vi.hoisted(() => ({
  rpc: vi.fn(),
  read: vi.fn(),
  orders: vi.fn(),
  quote: vi.fn(),
  course: vi.fn(),
  bind: vi.fn(),
  reconcile: vi.fn(),
}));
vi.mock("../backend/payments/providers.ts", () => ({
  getCheckoutProvider: () => ({ name: "upi" }),
}));
vi.mock("../backend/payments/indianxtrade.ts", () => ({ sharedUpiGateway: () => true }));
vi.mock("../backend/purchase/upi-gateway.ts", () => ({
  bindGatewayPurchase: bind,
  reconcileGatewayPurchase: reconcile,
}));
vi.mock("../backend/purchase/repository.ts", () => ({
  purchaseRpc: rpc,
  purchaseOrder: read,
  purchaseOrders: orders,
  purchaseQuoteCoupon: quote,
  purchaseCourse: course,
}));
const user = {
  id: "student",
  name: "Student",
  email: "student@example.invalid",
  role: "student",
} as PurchaseUser;
afterEach(() => vi.resetAllMocks());
it("rejects a coupon below the gateway minimum before creating any saved or remote payment", async () => {
  orders.mockResolvedValue([]);
  quote.mockResolvedValue({ total: 100 });
  await expect(
    createPurchase(user, "course", "https://academy.example", "LOWTOTAL"),
  ).rejects.toThrow("at least INR 510");
  expect(rpc).not.toHaveBeenCalled();
  expect(bind).not.toHaveBeenCalled();
});
it("binds an allowed course order through the shared gateway adapter", async () => {
  orders.mockResolvedValue([]);
  course.mockResolvedValue({ price: 199900 });
  rpc.mockResolvedValue("saved-order");
  bind.mockResolvedValue({ id: "saved-order", amount: 199050 });
  expect(await createPurchase(user, "course", "https://academy.example")).toEqual({
    id: "saved-order",
    amount: 199050,
  });
  expect(bind).toHaveBeenCalledWith("saved-order", "student");
});
it("reconciles an already completed gateway payment before a retry can create another order", async () => {
  const existing = {
    id: "saved-order",
    courseId: "course",
    status: "pending",
    provider: "upi",
    providerOrderId: "upi_saved-order",
  };
  orders.mockResolvedValue([existing]);
  reconcile.mockResolvedValue({ ...existing, status: "paid" });
  expect((await createPurchase(user, "course", "https://academy.example")).status).toBe("paid");
  expect(rpc).not.toHaveBeenCalled();
  expect(bind).not.toHaveBeenCalled();
});
