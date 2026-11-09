import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useBillingOrders } from "../frontend/lib/use-billing-orders";
import { StudentBillingPanel } from "../frontend/components/student/student-billing-panel";
import type { PurchaseOrder, PurchaseOrdersPage } from "../shared/purchase";

const empty: PurchaseOrder[] = [];
const fetcher = vi.fn();
const order = (
  n: number,
  provider: PurchaseOrder["provider"] = "cashfree",
  status = "paid",
): PurchaseOrder => ({
  id: `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  userId: "owner",
  courseId: "course",
  slug: "course",
  courseTitle: `Historical course ${n}`,
  amount: 12345,
  base: 12345,
  tax: 0,
  currency: "INR",
  status,
  provider,
  providerOrderId: null,
  createdAt: "2026-11-09T10:00:00.123456+00:00",
  paidAt: null,
  accessPeriod: 1,
  accessUnit: "months",
  accessExpiresAt: null,
});
const cursor = (n: number) => ({ id: order(n).id, createdAt: order(n).createdAt });
const page = (
  orders: PurchaseOrder[],
  overrides: Partial<PurchaseOrdersPage> = {},
): PurchaseOrdersPage => ({
  orders,
  nextCursor: null,
  totalCount: 40,
  filteredCount: 40,
  totalAmount: 493800,
  paidAmount: 493800,
  pendingCount: 0,
  unsupportedPendingCount: 0,
  pending: [],
  nextPendingCursor: null,
  ...overrides,
});
const respond = (data: unknown) => ({ ok: true, json: async () => data });
function Harness({ initial }: { initial?: PurchaseOrdersPage }) {
  const state = useBillingOrders(initial?.orders ?? empty, true, !!initial, initial);
  return (
    <StudentBillingPanel
      {...state}
      onBrowseCourses={() => {}}
      onRefresh={state.refresh}
      onNextPage={state.nextPage}
      onPreviousPage={state.previousPage}
      onStatusChange={state.setStatus}
      onProviderChange={state.setProvider}
    />
  );
}
beforeEach(() => {
  vi.useFakeTimers();
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const settle = async () => {
  await act(async () => {});
};

it("resets seeded totals, filters and cursors on replacement server data and ignores the old reply", async () => {
  const first = page([order(77)], { totalCount: 77, filteredCount: 77, nextCursor: cursor(77) });
  const replacement = page([order(2)], {
    totalCount: 2,
    filteredCount: 2,
    totalAmount: 24690,
    paidAmount: 24690,
  });
  let finish!: (value: ReturnType<typeof respond>) => void;
  fetcher.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<Harness initial={first} />);
  await settle();
  fireEvent.click(screen.getByRole("button", { name: "Next orders" }));
  await settle();
  view.rerender(<Harness initial={replacement} />);
  await settle();
  expect(screen.getByText(/2 orders/)).toHaveTextContent("2 matching");
  expect(screen.queryByText(/77 orders/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Previous orders" })).toBeDisabled();
  expect(screen.getByLabelText("Order status")).toHaveValue("all");
  expect(screen.getByLabelText("Payment provider")).toHaveValue("all");
  expect(screen.getByText("Historical course 2")).toBeVisible();
  await act(async () => finish(respond(first)));
  expect(screen.getByText(/2 orders/)).toBeVisible();
  expect(screen.queryByText("Historical course 77")).not.toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("pages both ways using exact tied-date cursor, preserves receipt routing/global totals and resets filters", async () => {
  fetcher.mockImplementation(async (url: string) => {
    const query = new URL(url, "https://example.invalid").searchParams;
    return respond(
      query.has("cursor") ? page([order(2, "upi")]) : page([order(1)], { nextCursor: cursor(1) }),
    );
  });
  render(<Harness />);
  await settle();
  expect(screen.getByText(/40 orders/)).toHaveTextContent("Total ₹4,938");
  expect(screen.getByRole("link", { name: "View receipt" })).toHaveAttribute(
    "href",
    `/api/orders/${order(1).id}/document`,
  );
  fireEvent.click(screen.getByRole("button", { name: "Next orders" }));
  await settle();
  expect(screen.getByText("Historical course 2")).toBeVisible();
  expect(screen.getByRole("link", { name: "View receipt" })).toHaveAttribute(
    "href",
    `/dashboard/orders/${order(2).id}/receipt`,
  );
  expect(
    JSON.parse(
      new URL(fetcher.mock.calls[1][0], "https://example.invalid").searchParams.get("cursor")!,
    ),
  ).toEqual(cursor(1));
  expect(screen.getByRole("button", { name: "Next orders" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Previous orders" }));
  await settle();
  expect(screen.getByText("Historical course 1")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Order status"), { target: { value: "refunded" } });
  await settle();
  expect(fetcher.mock.calls.at(-1)![0]).toContain("status=refunded");
  expect(fetcher.mock.calls.at(-1)![0]).not.toContain("cursor=");
  fireEvent.change(screen.getByLabelText("Payment provider"), { target: { value: "upi" } });
  await settle();
  expect(fetcher.mock.calls.at(-1)![0]).toContain("provider=upi");
});

it("keeps Phase3 simple pending budget: 40 status checks and seven history pages", async () => {
  const pending = order(1, "cashfree", "pending");
  fetcher.mockImplementation(async (url: string) =>
    respond(
      url.includes("/status/")
        ? { order: { status: "pending" } }
        : page([pending], { pendingCount: 1, pending: [pending] }),
    ),
  );
  render(<Harness />);
  await settle();
  await act(async () => vi.advanceTimersByTimeAsync(240_000));
  expect(fetcher.mock.calls.filter(([url]) => url.includes("/status/"))).toHaveLength(40);
  expect(fetcher.mock.calls.filter(([url]) => url.includes("/purchase/orders"))).toHaveLength(7);
});

it("shows a saved receipt after settling an older-page payment and retains global count", async () => {
  const older = order(99, "demo", "pending");
  let saved = false;
  fetcher.mockImplementation(async (url: string) => {
    if (url.includes("/status/")) {
      saved = true;
      return respond({ order: { status: "paid" } });
    }
    const next = new URL(url, "https://example.invalid").searchParams.has("cursor");
    return respond(
      page(next ? [{ ...older, status: saved ? "paid" : "pending" }] : [order(1)], {
        nextCursor: next ? null : cursor(1),
        pendingCount: saved ? 0 : 1,
        pending: saved ? [] : [older],
      }),
    );
  });
  render(<Harness />);
  await settle();
  expect(saved).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next orders" }));
  await settle();
  expect(screen.getByText("Historical course 99")).toBeVisible();
  expect(screen.getByRole("link", { name: "View receipt" })).toHaveAttribute(
    "href",
    `/api/orders/${older.id}/document`,
  );
  expect(screen.getByText(/40 orders/)).toHaveTextContent("0 pending");
});

it("discovers >4 older pending payments past periodic refresh, settles off-page and resets rotation on focus/manual", async () => {
  const pending = Array.from({ length: 36 }, (_, n) => order(n + 100, "cashfree", "pending"));
  const checked: string[] = [];
  let paid = false;
  fetcher.mockImplementation(async (url: string) => {
    if (url.includes("/status/")) {
      checked.push(url.split("/").at(-1)!);
      if (url.endsWith(pending[35].id)) paid = true;
      return respond({
        order: { status: paid && url.endsWith(pending[35].id) ? "paid" : "pending" },
      });
    }
    const query = new URL(url, "https://example.invalid").searchParams;
    if (query.has("pending")) {
      const after = query.get("pendingCursor");
      const start = after ? pending.findIndex((o) => o.id === JSON.parse(after).id) + 1 : 0;
      const slice = pending.slice(start, start + 4);
      return respond(
        page([], {
          pendingCount: paid ? 35 : 36,
          pending: slice,
          nextPendingCursor:
            start + 4 < pending.length
              ? { id: slice.at(-1)!.id, createdAt: slice.at(-1)!.createdAt }
              : null,
        }),
      );
    }
    return respond(
      page([order(1)], {
        pendingCount: paid ? 35 : 36,
        paidAmount: paid ? 500000 : 493800,
        pending: pending.slice(0, 4),
      }),
    );
  });
  render(<Harness />);
  await settle();
  await act(async () => vi.advanceTimersByTimeAsync(40_000));
  expect(new Set(checked).size).toBe(36);
  expect(screen.getByText(/40 orders/)).toHaveTextContent("35 pending");
  expect(screen.getByRole("link", { name: "View receipt" })).toBeVisible();
  await act(async () => window.dispatchEvent(new Event("focus")));
  let discoveries = fetcher.mock.calls.filter(([url]) => url.includes("pending=1"));
  expect(discoveries.at(-1)![0]).not.toContain("pendingCursor");
  fireEvent.click(screen.getByRole("button", { name: "Refresh payments" }));
  await settle();
  discoveries = fetcher.mock.calls.filter(([url]) => url.includes("pending=1"));
  expect(discoveries.at(-1)![0]).not.toContain("pendingCursor");
});

it("polls an off-page UPI pending order even when the visible page has only paid receipts", async () => {
  const pending = order(100, "upi", "pending");
  const initial = page([order(1)], {
    pendingCount: 1,
    unsupportedPendingCount: 1,
    pending: [pending],
  });
  fetcher.mockResolvedValue(respond(initial));
  render(<Harness initial={initial} />);
  await settle();
  await act(async () => vi.advanceTimersByTimeAsync(15_000));
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(fetcher.mock.calls.every(([url]) => url.includes("limit=20"))).toBe(true);
  fetcher.mockResolvedValue(respond(page([order(1)])));
  await act(async () => vi.advanceTimersByTimeAsync(5_000));
  const count = fetcher.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(60_000));
  expect(fetcher).toHaveBeenCalledTimes(count);
});
