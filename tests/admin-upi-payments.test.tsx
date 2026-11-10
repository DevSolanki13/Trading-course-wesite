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
it("checks a bound Academy order with manual approval option available", async () => {
  mocks.fetch.mockImplementation(async (path: string) => ({
    ok: true,
    json: async () =>
      path.endsWith("upi-check")
        ? { message: "The gateway has not confirmed payment yet." }
        : { ...base, items: [order], total: 1 },
  }));
  render(<UpiPaymentsPanel />);
  expect(await screen.findByRole("button", { name: "Approve manually" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Check payment" }));
  expect(await screen.findByText("The gateway has not confirmed payment yet.")).toBeInTheDocument();
  expect(mocks.fetch).toHaveBeenCalledWith(
    "/api/admin/upi-check",
    expect.objectContaining({ method: "POST", body: JSON.stringify({ id: order.id }) }),
  );
});

it("opens manual approval modal, validates inputs, and submits approval", async () => {
  mocks.fetch.mockImplementation(async (path: string) => {
    if (path.endsWith("upi-manual-approve")) {
      return {
        ok: true,
        json: async () => ({
          status: "paid",
          message: "Payment approved manually and course access granted.",
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({ ...base, items: [order], total: 1 }),
    };
  });

  render(<UpiPaymentsPanel />);
  fireEvent.click(await screen.findByRole("button", { name: "Approve manually" }));

  // Modal opens
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Approve payment manually")).toBeInTheDocument();
  expect(screen.getByText(/Caution:/)).toBeInTheDocument();

  // Test validation: invalid/empty UTR
  const form = screen.getByRole("form", { name: "Manual approval form" });
  const utrInput = screen.getByPlaceholderText(/123456789012/);
  fireEvent.change(utrInput, { target: { value: "bad" } });
  fireEvent.submit(form);
  expect(
    await screen.findByText("UTR must be 6 to 32 uppercase alphanumeric characters."),
  ).toBeInTheDocument();

  // Test validation: short reason
  fireEvent.change(utrInput, { target: { value: "123456789012" } });
  const reasonInput = screen.getByPlaceholderText(
    /Explain why this payment is being manually approved/,
  );
  fireEvent.change(reasonInput, { target: { value: "Too short" } });
  fireEvent.submit(form);
  expect(
    await screen.findByText("Reason must be between 10 and 300 characters."),
  ).toBeInTheDocument();

  // Fix reason and submit valid approval
  fireEvent.change(reasonInput, {
    target: { value: "Verified with bank branch manager directly" },
  });
  const checkbox = screen.getByLabelText(/I checked this payment in the bank statement/);
  fireEvent.click(checkbox);

  fireEvent.submit(form);

  await waitFor(() => {
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/admin/upi-manual-approve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          id: order.id,
          utr: "123456789012",
          reason: "Verified with bank branch manager directly",
          confirmAmount: 99900,
          bankChecked: true,
        }),
      }),
    );
  });

  expect(
    await screen.findByText("Payment approved manually and course access granted."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("shows failure inside manual approval dialog and keeps modal open", async () => {
  mocks.fetch.mockImplementation(async (path: string) => {
    if (path.endsWith("upi-manual-approve")) {
      return {
        ok: false,
        status: 409,
        json: async () => ({ error: "This UTR has already been used to approve an order." }),
      };
    }
    return {
      ok: true,
      json: async () => ({ ...base, items: [order], total: 1 }),
    };
  });

  render(<UpiPaymentsPanel />);
  fireEvent.click(await screen.findByRole("button", { name: "Approve manually" }));

  const form = screen.getByRole("form", { name: "Manual approval form" });
  const utrInput = screen.getByPlaceholderText(/123456789012/);
  fireEvent.change(utrInput, { target: { value: "123456789012" } });
  const reasonInput = screen.getByPlaceholderText(
    /Explain why this payment is being manually approved/,
  );
  fireEvent.change(reasonInput, { target: { value: "Valid reason for payment approval test" } });

  fireEvent.submit(form);

  expect(
    await screen.findByText("This UTR has already been used to approve an order."),
  ).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("shows Manual badge and approval details on history rows", async () => {
  const manualOrder = {
    ...order,
    status: "paid",
    manualApproval: {
      by: "Head Admin",
      at: "2026-11-10T20:00:00Z",
      reason: "Confirmed via bank branch statement",
    },
  };
  mocks.fetch.mockImplementation(async () => ({
    ok: true,
    json: async () => ({ ...base, items: [manualOrder], total: 1 }),
  }));

  render(<UpiPaymentsPanel />);
  expect(await screen.findByText("Manual")).toBeInTheDocument();
  expect(screen.getByText(/Approved by Head Admin/)).toBeInTheDocument();
  expect(screen.getByText(/Confirmed via bank branch statement/)).toBeInTheDocument();
  // No approve button for paid orders
  expect(screen.queryByRole("button", { name: "Approve manually" })).not.toBeInTheDocument();
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
