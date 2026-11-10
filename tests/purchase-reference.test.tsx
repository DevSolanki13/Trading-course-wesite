import { beforeEach, expect, it, vi } from "vitest";
import { purchaseRequest } from "../backend/handlers/purchase";
const { read, rpc, origin, settle } = vi.hoisted(() => ({
  read: vi.fn(),
  rpc: vi.fn(),
  origin: vi.fn(),
  settle: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../backend/purchase/service", () => ({ createPurchase: vi.fn(), settlePurchase: settle }));
vi.mock("../backend/purchase/session", () => ({ purchaseUser: async () => ({ id: "student" }) }));
vi.mock("../backend/purchase/mode", () => ({ localDemoEnabled: () => false }));
vi.mock("../backend/purchase/repository", () => ({ purchaseOrder: read, purchaseRpc: rpc }));
vi.mock("../backend/purchase/mail", () => ({ sendPurchaseReceipt: vi.fn() }));
vi.mock("../backend/local/http", () => ({ purchaseOrigin: origin }));
vi.mock("../backend/auth/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../backend/auth/http")>()),
  limit: vi.fn(),
}));
const id = "11111111-1111-4111-8111-111111111111";
const order = { id, provider: "upi", status: "pending", upi: { amount: 147914 }, amount: 147914 };
const submit = (body: unknown) =>
  purchaseRequest(
    new Request("https://academy.example/api/purchase/reference", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue(order);
});
it("saves an owner-scoped claim without settling money or granting access", async () => {
  const saved = {
    ...order,
    paymentReference: { reference: "ABC123456789", submittedAt: "2026-11-10T06:00:00Z" },
  };
  read.mockResolvedValueOnce(order).mockResolvedValueOnce(saved);
  const response = await submit({ orderId: id, reference: " abc123456789 " });
  expect(response.status).toBe(200);
  expect((await response.json()).order).toEqual(saved);
  expect(origin).toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith("purchase_upi_reference", {
    p_user: "student",
    p_order: id,
    p_reference: "ABC123456789",
  });
  expect(settle).not.toHaveBeenCalled();
});
it.each(["bad", "123<script>", "1".repeat(33)])(
  "rejects invalid reference %s",
  async (reference) => {
    expect((await submit({ orderId: id, reference })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  },
);
it("rejects order probing and client-supplied payment status or amount", async () => {
  read.mockResolvedValueOnce(null);
  expect((await submit({ orderId: id, reference: "123456789012" })).status).toBe(404);
  expect(
    (await submit({ orderId: id, reference: "123456789012", status: "paid", amount: 1 })).status,
  ).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it("does not overwrite paid orders and allows claims for an expired bound order", async () => {
  read.mockResolvedValueOnce({ ...order, status: "paid" });
  expect((await submit({ orderId: id, reference: "123456789012" })).status).toBe(200);
  expect(rpc).not.toHaveBeenCalled();
  read.mockResolvedValue({ ...order, status: "cancelled" });
  expect((await submit({ orderId: id, reference: "123456789012" })).status).toBe(200);
  expect(rpc).toHaveBeenCalledTimes(1);
});
