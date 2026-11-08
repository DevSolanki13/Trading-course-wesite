import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UpiPaymentsPanel } from "../frontend/components/admin/upi-payments-panel";
import { adminRequest } from "../backend/handlers/admin";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  privileged: vi.fn(),
  fetch: vi.fn(),
  localSession: vi.fn(),
  readOrder: vi.fn(),
  reconcile: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../backend/auth/session", () => ({ privileged: mocks.privileged, audit: vi.fn() }));
vi.mock("../backend/local/auth", () => ({
  LOCAL_SESSION_COOKIE: "session",
  localSession: mocks.localSession,
}));
vi.mock("../backend/purchase/repository", () => ({ purchaseOrder: mocks.readOrder }));
vi.mock("../backend/purchase/upi-gateway", () => ({ reconcileGatewayPurchase: mocks.reconcile }));
const base = {
  items: [],
  total: 0,
  counts: { review: 0, unmatched: 1 },
  syncedAt: new Date().toISOString(),
};
const credit = {
  id: "credit",
  utr: "123456789012",
  amount: 99900,
  receivedAt: new Date().toISOString(),
};
const order = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "user",
  studentName: "Academy Student",
  email: "student@example.invalid",
  course: "Trading basics",
  amount: 99900,
  createdAt: new Date().toISOString(),
  paidAt: null,
  utr: null,
  gatewayStatus: "PENDING_CONFIRMATION",
  status: "pending",
  gatewayBound: true,
  reviewReason: "Payment needs verification",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("LOCAL_DEMO", "false");
  vi.stubEnv("PAYMENT_PROVIDER", "upi");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockImplementation(async (path: string) => ({
    ok: true,
    json: async () =>
      path.includes("tab=unmatched") ? { ...base, items: [credit], total: 1 } : base,
  }));
  mocks.privileged.mockResolvedValue({ admin: { rpc: mocks.rpc }, user: { id: "admin" } });
  mocks.rpc.mockResolvedValue({ data: base, error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("shows the three UPI-only queues and labels unmatched credits as shared", async () => {
  render(<UpiPaymentsPanel />);
  expect(await screen.findByText("No Academy payments currently need review.")).toBeInTheDocument();
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  expect(screen.queryByText(/USDT/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /Unmatched credits/ }));
  expect(await screen.findByText(credit.utr)).toBeInTheDocument();
  expect(screen.getByText(/They may belong to Academy or IndianXtrade/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Find Academy orders" }));
  await waitFor(() =>
    expect(mocks.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("q=999.00"),
      expect.anything(),
    ),
  );
  expect(screen.getByRole("textbox", { name: "Search payments" })).toHaveValue("999.00");
});
it("checks a bound Academy order without a manual credit approval", async () => {
  mocks.fetch.mockImplementation(async (path: string) => ({
    ok: true,
    json: async () =>
      path.endsWith("upi-check")
        ? { message: "The gateway has not confirmed payment yet." }
        : { ...base, items: [order], total: 1 },
  }));
  render(<UpiPaymentsPanel />);
  fireEvent.click(await screen.findByRole("button", { name: "Check payment" }));
  expect(await screen.findByText("The gateway has not confirmed payment yet.")).toBeInTheDocument();
  expect(mocks.fetch).toHaveBeenCalledWith(
    "/api/admin/upi-check",
    expect.objectContaining({ method: "POST", body: JSON.stringify({ id: order.id }) }),
  );
  expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
});
it("shows delayed sync and fetch failures without claiming a clear bank queue", async () => {
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ ...base, syncedAt: null }) });
  render(<UpiPaymentsPanel />);
  expect(await screen.findByText(/Bank records have not synced yet/)).toBeInTheDocument();
  mocks.fetch.mockRejectedValue(new Error("Bank records unavailable"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Bank records unavailable");
});
it("protects Academy payment records with administrator authentication and validates the view", async () => {
  let response = await adminRequest(
    new Request("http://localhost:3000/api/admin/upi-payments?tab=unmatched"),
  );
  expect(response.status).toBe(200);
  expect(mocks.privileged).toHaveBeenCalledWith(true);
  expect(mocks.rpc).toHaveBeenCalledWith("academy_upi_payment_read", {
    p_tab: "unmatched",
    p_query: "",
    p_page: 0,
  });
  response = await adminRequest(
    new Request("http://localhost:3000/api/admin/upi-payments?tab=usdt"),
  );
  expect(response.status).toBe(400);
  mocks.privileged.mockRejectedValue(new Error("not authorized"));
  response = await adminRequest(new Request("http://localhost:3000/api/admin/upi-payments"));
  expect(response.status).toBe(503);
});
it("denies support access in local mode too", async () => {
  vi.stubEnv("PAYMENT_PROVIDER", "demo");
  vi.stubEnv("LOCAL_DEMO", "true");
  mocks.localSession.mockResolvedValue({ id: "support", role: "support" });
  const response = await adminRequest(new Request("http://localhost:3000/api/admin/upi-payments"));
  expect(response.status).toBe(403);
});
