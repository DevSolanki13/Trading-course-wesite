import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBillingOrders } from "../frontend/lib/use-billing-orders";
import { StudentBillingPanel } from "../frontend/components/student/student-billing-panel";
import { commerceOrders } from "../backend/purchase/billing";
import { purchaseOrder, purchaseOrders } from "../backend/purchase/repository";
import type { PurchaseOrder } from "../shared/purchase";

const db = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  order: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../backend/database/supabase", () => ({ createAdminClient: () => db }));
vi.mock("../backend/purchase/mode.ts", () => ({ localDemoEnabled: () => false }));

const pending: PurchaseOrder = {
  id: "11111111-1111-4111-8111-111111111111",
  courseId: "course-fixture",
  slug: "basic-to-advance",
  courseTitle: "Basic to Advance",
  userId: "owner-fixture",
  amount: 199900,
  tax: 0,
  base: 199900,
  currency: "INR",
  status: "pending",
  provider: "cashfree",
  providerOrderId: "cf_sbx_fixture",
  createdAt: "2026-11-06T09:00:00Z",
  paidAt: null,
  accessPeriod: 1,
  accessUnit: "months",
  accessExpiresAt: null,
};
const paid = { ...pending, status: "paid", paidAt: "2026-11-06T09:01:00Z" };
const initial = [pending];
const empty: PurchaseOrder[] = [];
const response = (value: unknown, ok = true) => ({ ok, json: async () => value });
const request = vi.fn();
function Harness({
  orders = initial,
  active = true,
  fresh = false,
}: {
  orders?: PurchaseOrder[];
  active?: boolean;
  fresh?: boolean;
}) {
  const state = useBillingOrders(orders, active, fresh);
  return (
    <StudentBillingPanel
      orders={state.orders}
      syncing={state.syncing}
      error={state.error}
      onRefresh={state.refresh}
      onBrowseCourses={() => {}}
    />
  );
}
async function mount(props: { orders?: PurchaseOrder[]; active?: boolean; fresh?: boolean } = {}) {
  const view = render(<Harness {...props} />);
  await act(async () => {});
  return view;
}
beforeEach(() => {
  vi.clearAllMocks();
  request.mockReset();
  db.from.mockReturnValue(db);
  db.select.mockReturnValue(db);
  db.eq.mockReturnValue(db);
  db.is.mockReturnValue(db);
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("owner-scoped billing history", () => {
  function row() {
    return {
      id: paid.id,
      user_id: paid.userId,
      course_id: paid.courseId,
      provider_order_id: paid.providerOrderId,
      status: "paid",
      currency: "INR",
      base_paise: 199900,
      tax_paise: 0,
      total_paise: 199900,
      course_snapshot: {
        slug: paid.slug,
        title: "Purchased course title",
        access_period: 3,
        access_unit: "months",
      },
      created_at: paid.createdAt,
      paid_at: paid.paidAt,
      enrollments: [{ expires_at: "2027-02-06T09:01:00Z" }],
    };
  }
  it("reads Cashfree history with an explicit owner filter and immutable purchase values", async () => {
    db.order.mockResolvedValue({ data: [row()], error: null });
    const orders = await commerceOrders(paid.userId);
    expect(db.eq).toHaveBeenCalledWith("user_id", paid.userId);
    expect(db.is).toHaveBeenCalledWith("purchase_provider", null);
    expect(orders[0]).toMatchObject({
      provider: "cashfree",
      status: "paid",
      amount: 199900,
      courseTitle: "Purchased course title",
      accessPeriod: 3,
    });
  });
  it("merges Cashfree and existing provider orders into one chronological history", async () => {
    const legacy = {
      ...paid,
      id: "older-order",
      provider: "razorpay",
      createdAt: "2026-11-05T09:00:00Z",
    };
    db.rpc.mockResolvedValue({ data: [legacy], error: null });
    db.order.mockResolvedValue({ data: [row()], error: null });
    expect((await purchaseOrders(paid.userId)).map((order) => order.id)).toEqual([
      paid.id,
      "older-order",
    ]);
  });
  it("looks up a Cashfree receipt only within the requesting user's orders", async () => {
    db.rpc.mockResolvedValue({ data: null, error: null });
    db.order.mockResolvedValue({ data: [], error: null });
    expect(await purchaseOrder(paid.id, "another-user")).toBeNull();
    expect(db.eq).toHaveBeenCalledWith("id", paid.id);
    expect(db.eq).toHaveBeenCalledWith("user_id", "another-user");
  });
  it("reports a database failure instead of claiming there is no history", async () => {
    db.order.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(commerceOrders(paid.userId)).rejects.toThrow(
      "Billing history is temporarily unavailable.",
    );
  });
});

describe("billing refresh and reconciliation", () => {
  beforeEach(() => vi.useFakeTimers());
  it("reconciles pending Cashfree payment, reloads the saved order, and exposes its document", async () => {
    request
      .mockResolvedValueOnce(response({ orders: [pending] }))
      .mockResolvedValueOnce(response({ order: { status: "paid" } }))
      .mockResolvedValueOnce(response({ orders: [paid] }));
    await mount();
    expect(screen.getByText("paid", { exact: true })).toBeVisible();
    expect(screen.getByRole("link", { name: "View receipt" })).toHaveAttribute(
      "href",
      `/api/orders/${paid.id}/document`,
    );
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/purchase/orders",
      `/api/checkout/status/${paid.id}`,
      "/api/purchase/orders",
    ]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(request).toHaveBeenCalledTimes(3);
  });
  it("refreshes an initially empty history immediately when the browser regains focus", async () => {
    request
      .mockResolvedValueOnce(response({ orders: [] }))
      .mockResolvedValueOnce(response({ orders: [paid] }));
    await mount({ orders: empty });
    expect(screen.getByText("No purchase history found")).toBeVisible();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(screen.getByRole("link", { name: "View receipt" })).toBeVisible();
  });
  it("displays a failed attempt on an open Cashfree order without exposing a receipt", async () => {
    request
      .mockResolvedValueOnce(response({ orders: [pending] }))
      .mockResolvedValueOnce(response({ order: { status: "pending", paymentStatus: "failed" } }));
    await mount();
    expect(screen.getByText("failed", { exact: true })).toBeVisible();
    expect(screen.queryByRole("link", { name: "View receipt" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Check status" })).toHaveAttribute(
      "href",
      `/checkout/status/${pending.id}`,
    );
  });
  it("keeps pending state and prevents receipt access when verification fails", async () => {
    request
      .mockResolvedValueOnce(response({ orders: [pending] }))
      .mockResolvedValueOnce(response({ error: "unavailable" }, false));
    await mount();
    expect(screen.getByText("pending", { exact: true })).toBeVisible();
    expect(screen.queryByRole("link", { name: "View receipt" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("avoid paying twice");
  });
  it("keeps saved receipts during a network failure and recovers on manual refresh", async () => {
    request.mockRejectedValueOnce(new Error("Connection interrupted"));
    await mount({ orders: [paid] });
    expect(screen.getByRole("alert")).toHaveTextContent("Connection interrupted");
    expect(screen.getByRole("link", { name: "View receipt" })).toBeVisible();
    request.mockResolvedValue(response({ orders: [paid] }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh payments" }));
    await act(async () => {});
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("does not display success until the refreshed database order is paid", async () => {
    request
      .mockResolvedValueOnce(response({ orders: [pending] }))
      .mockResolvedValueOnce(response({ order: { status: "paid" } }))
      .mockResolvedValueOnce(response({ orders: [pending] }));
    await mount();
    expect(screen.queryByRole("link", { name: "View receipt" })).not.toBeInTheDocument();
    expect(screen.getByText("pending", { exact: true })).toBeVisible();
  });
  it("waits for the billing tab to open, then reads current history", async () => {
    request.mockResolvedValue(response({ orders: [paid] }));
    const view = await mount({ active: false });
    expect(request).not.toHaveBeenCalled();
    view.rerender(<Harness active />);
    await act(async () => {});
    expect(screen.getByRole("link", { name: "View receipt" })).toBeVisible();
  });
  it("aborts requests and stops polling after the tab closes", async () => {
    request.mockImplementation(async (url) =>
      response(
        String(url).includes("/status/") ? { order: { status: "pending" } } : { orders: [pending] },
      ),
    );
    const view = await mount();
    const signal = request.mock.calls[0][1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("bounds automatic polling and retains a manual refresh action", async () => {
    request.mockImplementation(async (url) =>
      response(
        String(url).includes("/status/") ? { order: { status: "pending" } } : { orders: [pending] },
      ),
    );
    await mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(240000);
    });
    expect(request.mock.calls.filter(([url]) => url === "/api/purchase/orders")).toHaveLength(7);
    expect(request.mock.calls.filter(([url]) => String(url).includes("/status/"))).toHaveLength(40);
    expect(request).toHaveBeenCalledTimes(47);
    expect(screen.getByRole("button", { name: "Refresh payments" })).toBeEnabled();
  });

  it("uses a fresh server snapshot once, but rereads on focus and when billing reopens", async () => {
    request.mockResolvedValue(response({ orders: [paid] }));
    const orders = [paid];
    const view = await mount({ orders, fresh: true });
    expect(request).not.toHaveBeenCalled();
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(request).toHaveBeenCalledTimes(1);
    view.rerender(<Harness orders={orders} fresh active={false} />);
    view.rerender(<Harness orders={orders} fresh active />);
    await act(async () => {});
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("still checks a fresh pending snapshot immediately and waits for saved payment confirmation", async () => {
    request
      .mockResolvedValueOnce(response({ order: { status: "paid" } }))
      .mockResolvedValueOnce(response({ orders: [paid] }));
    await mount({ fresh: true });
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      `/api/checkout/status/${paid.id}`,
      "/api/purchase/orders",
    ]);
    expect(screen.getByRole("link", { name: "View receipt" })).toBeVisible();
  });

  it("keeps five-second history reads for UPI and other unsupported status providers", async () => {
    const order = { ...pending, provider: "upi" as const };
    request.mockResolvedValue(response({ orders: [order] }));
    await mount({ orders: [order] });
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(request.mock.calls.map(([url]) => url)).toEqual(Array(4).fill("/api/purchase/orders"));
  });

  it("does not overlap focus/status checks and pauses network work while hidden", async () => {
    let finish!: (value: unknown) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await mount();
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(request).toHaveBeenCalledTimes(1);
    request.mockImplementation(async (url) =>
      response(
        url === "/api/purchase/orders" ? { orders: [paid] } : { order: { status: "pending" } },
      ),
    );
    await act(async () => finish(response({ orders: [pending] })));
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(request).toHaveBeenCalledTimes(3);
    visibility.mockRestore();
    request.mockResolvedValue(response({ orders: [paid] }));
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByRole("link", { name: "View receipt" })).toBeVisible();
  });
});
