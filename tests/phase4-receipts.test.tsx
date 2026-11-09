import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { schedulePurchaseReceipt } from "../backend/purchase/mail";
import { purchaseRequest } from "../backend/handlers/purchase";
import Success from "../app/checkout/success/page";
import { POST } from "../app/api/webhooks/razorpay/route";

const m = vi.hoisted(() => ({
  after: vi.fn(),
  rpc: vi.fn(),
  send: vi.fn(),
  order: vi.fn(),
  confirmation: vi.fn(),
  settle: vi.fn(),
  verify: vi.fn(),
  webhook: vi.fn(),
  gateway: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: m.after }));
vi.mock("../backend/purchase/mode", () => ({ localDemoEnabled: () => false }));
vi.mock("../backend/purchase/repository", () => ({
  purchaseRpc: m.rpc,
  purchaseOrder: m.order,
  purchaseConfirmation: m.confirmation,
  purchaseCatalog: vi.fn(),
  purchaseCourse: vi.fn(),
  purchaseLesson: vi.fn(),
  purchaseOrders: vi.fn(),
  purchaseQuoteCoupon: vi.fn(),
}));
vi.mock("../backend/notifications/delivery", () => ({ sendNotification: m.send }));
vi.mock("../backend/database/supabase", () => ({ createAdminClient: vi.fn() }));
vi.mock("../backend/purchase/session", () => ({ purchaseUser: async () => user }));
vi.mock("../backend/purchase/pages", () => ({ requirePurchaseUser: async () => user }));
vi.mock("../backend/local/auth", () => ({ localRateLimit: vi.fn() }));
vi.mock("../backend/local/http", () => ({ purchaseOrigin: vi.fn() }));
vi.mock("../backend/purchase/service", () => ({
  settlePurchase: m.settle,
  createPurchase: vi.fn(),
}));
vi.mock("../backend/payments/indianxtrade", () => ({ sharedUpiGateway: m.gateway }));
vi.mock("../backend/purchase/upi-gateway", () => ({
  reconcileGatewayPurchase: async (order: unknown) => order,
}));
vi.mock("../frontend/components/purchase-confirmation", () => ({
  PurchaseConfirmation: () => null,
}));
vi.mock("../backend/auth/http", async (original) => ({
  ...(await original<typeof import("../backend/auth/http")>()),
  limit: vi.fn(),
}));
vi.mock("../backend/payments/providers", async (original) => ({
  ...(await original<typeof import("../backend/payments/providers")>()),
  getCheckoutProvider: () => ({ name: "razorpay", verifyPayment: m.verify }),
  getPaymentProvider: () => ({ name: "razorpay", handleWebhook: m.webhook }),
}));

const user = {
  id: "student",
  email: "student@example.invalid",
  name: "Student",
  role: "student" as const,
};
const id = "11111111-1111-4111-8111-111111111111";
const order = {
  id,
  status: "paid",
  provider: "razorpay",
  providerOrderId: "remote",
  amount: 10000,
  currency: "INR",
};
const row = {
  id: "notice",
  attempts: 2,
  dedupe_key: `purchase:${id}`,
  subject: "Saved receipt",
  body: "INR 100.00",
};
const callbacks: (() => Promise<void>)[] = [];

beforeEach(() => {
  vi.resetAllMocks();
  callbacks.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Network forbidden");
    }),
  );
  vi.stubEnv("RESEND_API_KEY", "fixture");
  vi.stubEnv("RESEND_FROM_EMAIL", "fixture@example.invalid");
  m.after.mockImplementation((callback) => callbacks.push(callback));
  m.rpc.mockImplementation(async (name) => (name === "purchase_mail_claim" ? row : null));
  m.send.mockResolvedValue(true);
  m.order.mockResolvedValue(order);
  m.confirmation.mockResolvedValue({ order: { ...order, provider: "upi" }, expired: false });
  m.verify.mockResolvedValue(order);
  m.webhook.mockResolvedValue(order);
  m.gateway.mockReturnValue(false);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("registers a tracked attempt without starting transport or claiming before the response", async () => {
  expect(schedulePurchaseReceipt(id, user)).toBeUndefined();
  expect(m.rpc).not.toHaveBeenCalled();
  expect(m.send).not.toHaveBeenCalled();
  await callbacks[0]();
  expect(m.rpc).toHaveBeenNthCalledWith(1, "purchase_mail_claim", { p_user: user.id, p_order: id });
  expect(m.send).toHaveBeenCalledWith(row, user.email);
  expect(m.rpc).toHaveBeenLastCalledWith("purchase_mail_finish", {
    p_id: row.id,
    p_attempt: 2,
    p_success: true,
  });
});

it.each([false, "throw"])("keeps rejected/failed transport retryable: %s", async (outcome) => {
  if (outcome === "throw") m.send.mockRejectedValue(new Error("private provider body"));
  else m.send.mockResolvedValue(false);
  schedulePurchaseReceipt(id, user);
  await expect(callbacks[0]()).resolves.toBeUndefined();
  expect(m.rpc).toHaveBeenLastCalledWith("purchase_mail_finish", {
    p_id: row.id,
    p_attempt: 2,
    p_success: false,
  });
});

it("leaves duplicate/non-due claims alone", async () => {
  m.rpc.mockResolvedValue(null);
  schedulePurchaseReceipt(id, user);
  await callbacks[0]();
  expect(m.send).not.toHaveBeenCalled();
  expect(m.rpc).toHaveBeenCalledTimes(1);
});

it("leaves unconfigured transport queued without claiming", async () => {
  vi.stubEnv("RESEND_FROM_EMAIL", "");
  schedulePurchaseReceipt(id, user);
  await callbacks[0]();
  expect(m.rpc).not.toHaveBeenCalled();
  expect(m.send).not.toHaveBeenCalled();
});

it("does not fail payment confirmation when after registration fails", () => {
  m.after.mockImplementation(() => {
    throw new Error("unavailable context");
  });
  expect(() => schedulePurchaseReceipt(id, user)).not.toThrow();
  expect(m.rpc).not.toHaveBeenCalled();
});

it("contains a finish failure so the worker can recover the lease", async () => {
  m.rpc.mockRejectedValueOnce(new Error("database unavailable"));
  schedulePurchaseReceipt(id, user);
  await expect(callbacks[0]()).resolves.toBeUndefined();
  expect(m.send).not.toHaveBeenCalled();
  m.rpc.mockResolvedValueOnce(row).mockRejectedValueOnce(new Error("finish unavailable"));
  schedulePurchaseReceipt(id, user);
  await expect(callbacks[1]()).resolves.toBeUndefined();
  expect(m.send).toHaveBeenCalledTimes(1);
});

it("returns paid verification before a held transport finishes", async () => {
  let release!: (accepted: boolean) => void;
  m.send.mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        release = resolve;
      }),
  );
  const response = await purchaseRequest(
    new Request("https://app.example/api/purchase/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id, payment: {} }),
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ order });
  expect(m.settle).toHaveBeenCalledWith(order);
  expect(callbacks).toHaveLength(1);
  expect(m.send).not.toHaveBeenCalled();
  const pending = callbacks[0]();
  await Promise.resolve();
  expect(m.send).toHaveBeenCalledTimes(1);
  release(true);
  await pending;
});

it("returns a paid UPI poll and renders confirmation before claiming mail", async () => {
  m.order.mockResolvedValue({ ...order, provider: "upi" });
  const response = await purchaseRequest(
    new Request(`https://app.example/api/purchase/order?id=${id}`),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).order.status).toBe("paid");
  expect(await Success({ searchParams: Promise.resolve({ orderId: id }) })).toBeTruthy();
  expect(callbacks).toHaveLength(2);
  expect(m.rpc).not.toHaveBeenCalled();
});

it("acknowledges a settled webhook without waiting for mail", async () => {
  m.rpc.mockResolvedValue({ orderId: id, user });
  const response = await POST(
    new Request("https://app.example/api/webhooks/razorpay", { method: "POST" }),
  );
  expect(await response.json()).toEqual({ received: true });
  expect(m.settle).toHaveBeenCalledWith(order);
  expect(callbacks).toHaveLength(1);
  expect(m.send).not.toHaveBeenCalled();
  expect(m.rpc).toHaveBeenCalledTimes(1); // owner lookup, no transport claim
});

it("does not schedule receipts for unpaid confirmation/poll/verification/webhook", async () => {
  m.order.mockResolvedValue({ ...order, status: "pending" });
  m.confirmation.mockResolvedValue({ order: { ...order, status: "pending" }, expired: false });
  m.webhook.mockResolvedValue({ ...order, status: "failed" });
  await purchaseRequest(new Request(`https://app.example/api/purchase/order?id=${id}`));
  await Success({ searchParams: Promise.resolve({ orderId: id }) });
  await purchaseRequest(
    new Request("https://app.example/api/purchase/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id, payment: {} }),
    }),
  );
  await POST(new Request("https://app.example/api/webhooks/razorpay", { method: "POST" }));
  expect(callbacks).toHaveLength(0);
});
