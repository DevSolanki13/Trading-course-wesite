import { afterEach, expect, it, vi } from "vitest";
import { purchaseRequest } from "../backend/handlers/purchase";
import { GatewayError } from "../backend/payments/gateway-error";
import type { PurchaseOrder } from "../shared/purchase";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../backend/purchase/service", () => ({ createPurchase: create, settlePurchase: vi.fn() }));
vi.mock("../backend/purchase/session", () => ({ purchaseUser: async () => ({ id: "student" }) }));
vi.mock("../backend/purchase/mode", () => ({ localDemoEnabled: () => false }));
vi.mock("../backend/purchase/repository", () => ({}));
vi.mock("../backend/purchase/mail", () => ({ sendPurchaseReceipt: vi.fn() }));
vi.mock("../backend/local/http", () => ({ purchaseOrigin: vi.fn() }));
vi.mock("../backend/local/auth", () => ({ localRateLimit: vi.fn() }));
vi.mock("../backend/auth/http", () => ({
  AuthError: class extends Error {},
  body: (request: Request) => request.json(),
  failure: vi.fn(),
  limit: vi.fn(),
  json: (value: unknown, status = 200) => Response.json(value, { status }),
}));
vi.mock("../backend/payments/providers", () => ({
  getCheckoutProvider: () => ({ name: "upi" }),
  PaymentsUnavailableError: class extends Error {},
  InvalidPaymentSignatureError: class extends Error {},
}));
afterEach(() => {
  vi.restoreAllMocks();
  create.mockReset();
});
it.each(["ACCOUNT_MISMATCH", "SETUP_PENDING"] as const)(
  "returns actionable %s without private gateway instructions",
  async (code) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new GatewayError(code, {
      expectedAmount: 149900,
      amount: 149050,
      accountHash: "account-hash",
    });
    error.orderId = "owned-order";
    error.order = { id: "owned-order", status: "pending", amount: 149900 } as PurchaseOrder;
    if (code === "SETUP_PENDING") error.retryAfter = 120;
    create.mockRejectedValue(error);
    const response = await purchaseRequest(
      new Request("https://academy.example/api/purchase/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId: "course", terms: true }),
      }),
    );
    const data = await response.json();
    expect(response.status).toBe(code === "SETUP_PENDING" ? 409 : 502);
    expect(data.reference).toMatch(/^[0-9a-f-]{36}$/);
    expect(data.order.id).toBe("owned-order");
    expect(data.code).toBe(code);
    expect(data).not.toHaveProperty("details");
    expect(data).not.toHaveProperty("accountHash");
    expect(logged).toHaveBeenCalledWith(
      "Purchase gateway failure",
      expect.objectContaining({
        reference: data.reference,
        orderId: "owned-order",
        code,
        accountHash: "account-hash",
      }),
    );
    if (code === "SETUP_PENDING") expect(response.headers.get("Retry-After")).toBe("120");
  },
);
