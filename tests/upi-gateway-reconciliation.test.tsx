import { afterEach, expect, it, vi } from "vitest";
import { reconcileGatewayPurchase } from "../backend/purchase/upi-gateway";
import type { PurchaseOrder } from "../shared/purchase";
const { rpc, status, read } = vi.hoisted(() => ({ rpc: vi.fn(), status: vi.fn(), read: vi.fn() }));
vi.mock("../backend/purchase/repository.ts", () => ({ purchaseRpc: rpc, purchaseOrder: read }));
vi.mock("../backend/payments/indianxtrade.ts", () => ({
  IndianxtradeGateway: class {
    status = status;
  },
}));
const order = {
  id: "order",
  provider: "upi",
  status: "pending",
  providerOrderId: "upi_order",
  amount: 199050,
} as PurchaseOrder;
afterEach(() => {
  vi.resetAllMocks();
});
it("settles course access only after the bound IndianXtrade deposit is completed", async () => {
  rpc.mockResolvedValueOnce({ token: "bound-token", amount: 199050 });
  status.mockResolvedValue("COMPLETED");
  read.mockResolvedValue({ ...order, status: "paid" });
  expect((await reconcileGatewayPurchase(order, "student")).status).toBe("paid");
  expect(rpc).toHaveBeenCalledWith("purchase_upi_gateway_info", {
    p_user: "student",
    p_order: "order",
  });
  expect(rpc).toHaveBeenCalledWith("purchase_settle", {
    p_event: {
      provider: "upi",
      providerOrderId: "upi_order",
      providerPaymentId: "upi_indianxtrade_bound-token",
      amount: 199050,
      currency: "INR",
      status: "paid",
    },
  });
});
it("pending and unverifiable gateway states never grant course access", async () => {
  rpc.mockResolvedValue({ token: "bound-token", amount: 199050 });
  status.mockResolvedValue("AWAITING_PAYMENT");
  expect(await reconcileGatewayPurchase(order, "student")).toEqual(order);
  expect(rpc).toHaveBeenCalledTimes(1);
  status.mockRejectedValue(new Error("gateway unavailable"));
  await expect(reconcileGatewayPurchase(order, "student")).rejects.toThrow("gateway unavailable");
  expect(rpc).not.toHaveBeenCalledWith("purchase_settle", expect.anything());
});
it("closes a checkout only when the gateway declares it expired or rejected", async () => {
  rpc.mockResolvedValueOnce({ token: "bound-token", amount: 199050 });
  status.mockResolvedValue("EXPIRED");
  read.mockResolvedValue({ ...order, status: "cancelled" });
  expect((await reconcileGatewayPurchase(order, "student")).status).toBe("cancelled");
  expect(rpc).toHaveBeenCalledWith("purchase_upi_gateway_close", {
    p_user: "student",
    p_order: "order",
  });
});
