import { afterEach, expect, it, vi } from "vitest";
import { bindGatewayPurchase } from "../backend/purchase/upi-gateway";
import { GatewayError } from "../backend/payments/gateway-error";
import type { PurchaseOrder } from "../shared/purchase";

const { rpc, read, create, checkout, status } = vi.hoisted(() => ({
  rpc: vi.fn(),
  read: vi.fn(),
  create: vi.fn(),
  checkout: vi.fn(),
  status: vi.fn(),
}));
vi.mock("../backend/purchase/repository.ts", () => ({ purchaseRpc: rpc, purchaseOrder: read }));
vi.mock("../backend/payments/indianxtrade.ts", () => ({
  IndianxtradeGateway: class {
    create = create;
    checkoutIntent = checkout;
    status = status;
  },
}));
const order = {
  id: "order",
  status: "pending",
  provider: "upi",
  providerOrderId: null,
  amount: 149900,
} as PurchaseOrder;
const token = "x".repeat(32);
const remote = {
  token,
  amount: 149050,
  vpa: "second@bank",
  payeeName: "IndianXtrade",
  uri: "upi://pay?pa=second%40bank&am=1490.50&cu=INR",
  expiresAt: new Date(Date.now() + 50 * 60000).toISOString(),
};
afterEach(() => vi.resetAllMocks());

it("saves the token before reading the QR and reuses it after validation failure without creating a second deposit", async () => {
  const createdAt = new Date(Date.now() - 20 * 60000).toISOString();
  let savedToken: string | undefined;
  rpc.mockImplementation(async (name, args) => {
    if (name === "purchase_upi_gateway_prepare")
      return { state: savedToken ? "resume" : "create", token: savedToken, createdAt };
    if (name === "purchase_upi_gateway_save") savedToken = args.p_token;
  });
  read.mockResolvedValue(order);
  create.mockResolvedValue(token);
  checkout
    .mockImplementationOnce(async () => {
      expect(savedToken).toBe(token);
      throw new GatewayError("ACCOUNT_MISMATCH");
    })
    .mockResolvedValueOnce(remote);
  await expect(bindGatewayPurchase(order.id, "student")).rejects.toMatchObject({
    code: "ACCOUNT_MISMATCH",
    orderId: order.id,
    order,
  });
  await bindGatewayPurchase(order.id, "student");
  expect(create).toHaveBeenCalledTimes(1);
  expect(checkout).toHaveBeenLastCalledWith(token, order.amount, Date.parse(createdAt));
  expect(rpc).toHaveBeenCalledWith(
    "purchase_upi_gateway_bind",
    expect.objectContaining({ p_token: token, p_vpa: "second@bank", p_amount: 149050 }),
  );
  expect(rpc).toHaveBeenCalledWith(
    "purchase_upi_gateway_release",
    expect.objectContaining({ p_safe_retry: false }),
  );
});

it("retries a database bind failure using the known reservation", async () => {
  rpc.mockImplementation(async (name) => {
    if (name === "purchase_upi_gateway_prepare")
      return { state: "resume", token, createdAt: new Date().toISOString() };
    if (name === "purchase_upi_gateway_bind") throw new Error(`private database ${token}`);
  });
  read.mockResolvedValue(order);
  checkout.mockResolvedValue(remote);
  await expect(bindGatewayPurchase(order.id, "student")).rejects.toMatchObject({
    code: "SETUP_STORAGE",
    retryable: true,
  });
  expect(create).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith(
    "purchase_upi_gateway_release",
    expect.objectContaining({ p_safe_retry: false }),
  );
});

it.each(["busy", "unknown"])("does not call the gateway for a %s setup", async (state) => {
  read.mockResolvedValue(order);
  rpc.mockResolvedValue({ state, retryAfter: 120 });
  await expect(bindGatewayPurchase(order.id, "student")).rejects.toMatchObject({
    code: state === "busy" ? "SETUP_PENDING" : "CREATION_UNKNOWN",
    retryAfter: 120,
  });
  expect(create).not.toHaveBeenCalled();
  expect(checkout).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledTimes(1);
});

it.each([true, false])(
  "only releases an unsent or definitively rejected creation for immediate retry: %s",
  async (safe) => {
    read.mockResolvedValue(order);
    rpc.mockResolvedValue({ state: "create", createdAt: new Date().toISOString() });
    const error = new GatewayError("GATEWAY_UNAVAILABLE");
    error.safeToRetryCreation = safe;
    create.mockRejectedValue(error);
    await expect(bindGatewayPurchase(order.id, "student")).rejects.toMatchObject({
      code: safe ? "GATEWAY_UNAVAILABLE" : "CREATION_UNKNOWN",
    });
    expect(rpc).toHaveBeenCalledWith(
      "purchase_upi_gateway_release",
      expect.objectContaining({ p_safe_retry: safe }),
    );
    expect(checkout).not.toHaveBeenCalled();
  },
);

it("holds an ambiguous reservation if persisting its token fails", async () => {
  read.mockResolvedValue(order);
  rpc.mockImplementation(async (name) => {
    if (name === "purchase_upi_gateway_prepare")
      return { state: "create", createdAt: new Date().toISOString() };
    if (name === "purchase_upi_gateway_save") throw new Error("storage offline");
  });
  create.mockResolvedValue(token);
  await expect(bindGatewayPurchase(order.id, "student")).rejects.toMatchObject({
    code: "SETUP_STORAGE",
  });
  expect(checkout).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith(
    "purchase_upi_gateway_release",
    expect.objectContaining({ p_safe_retry: false }),
  );
});

it.each(["AWAITING_PAYMENT", "PENDING_CONFIRMATION", "COMPLETED", "EXPIRED", "REJECTED"])(
  "checks upstream %s before replacing an expired setup and never settles an unvalidated token",
  async (upstream) => {
    read.mockResolvedValue(order);
    rpc.mockResolvedValue({
      state: "resume",
      token,
      createdAt: new Date(Date.now() - 55 * 60000).toISOString(),
    });
    status.mockResolvedValue(upstream);
    if (upstream === "EXPIRED" || upstream === "REJECTED") {
      await bindGatewayPurchase(order.id, "student");
      expect(rpc).toHaveBeenCalledWith(
        "purchase_upi_gateway_abandon",
        expect.objectContaining({ p_token: token }),
      );
    } else {
      await expect(bindGatewayPurchase(order.id, "student")).rejects.toMatchObject({
        code: "SETUP_EXPIRED",
      });
      expect(rpc).not.toHaveBeenCalledWith("purchase_upi_gateway_abandon", expect.anything());
    }
    expect(create).not.toHaveBeenCalled();
    expect(checkout).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith("purchase_settle", expect.anything());
  },
);

it("never cancels an expired setup on an unverifiable upstream status", async () => {
  read.mockResolvedValue(order);
  rpc.mockResolvedValue({
    state: "resume",
    token,
    createdAt: new Date(Date.now() - 55 * 60000).toISOString(),
  });
  status.mockRejectedValue(new GatewayError("GATEWAY_UNAVAILABLE"));
  await expect(bindGatewayPurchase(order.id, "student")).rejects.toMatchObject({
    code: "GATEWAY_UNAVAILABLE",
  });
  expect(rpc).not.toHaveBeenCalledWith("purchase_upi_gateway_abandon", expect.anything());
});

it("uses the saved quote read after acquiring the creation lease", async () => {
  read.mockResolvedValueOnce({ ...order, amount: 199900 }).mockResolvedValue(order);
  rpc.mockResolvedValue({ state: "create", createdAt: new Date().toISOString() });
  create.mockResolvedValue(token);
  checkout.mockResolvedValue(remote);
  await bindGatewayPurchase(order.id, "student");
  expect(create).toHaveBeenCalledWith(149900);
});
