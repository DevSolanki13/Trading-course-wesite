import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrdersPanel } from "../frontend/components/admin/orders-panel";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../frontend/lib/admin-api", () => ({
  adminApi: api,
  money: (amount: number) => String(amount),
  when: (value: string) => value || "Not recorded",
}));
const orders = ["first", "second", "third"].map((id) => ({
  id,
  user_id: "fixture-student",
  course_id: id,
  course_snapshot: { title: `Course ${id}` },
  total_paise: 199900,
  status: "pending",
  created_at: "2026-11-08",
}));
function detail(id: string) {
  return {
    order: {
      ...orders.find((order) => order.id === id),
      base_paise: 199900,
      discount_paise: 0,
      tax_paise: 0,
    },
    payments: [],
    evidence: { reason: `Evidence for ${id}` },
    providerActionsAvailable: true,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function button(id: string) {
  return document.getElementById(`order-trigger-${id}`) as HTMLButtonElement;
}
async function mount() {
  const view = render(<OrdersPanel role="admin" />);
  await screen.findByText("Course first");
  return view;
}
beforeEach(() => {
  api.mockReset().mockImplementation(async (path: string) => {
    if (path === "order-filters") return { courses: [] };
    if (path.startsWith("orders?")) return { items: orders, total: 3 };
    if (path.startsWith("order?id=")) return detail(path.split("=")[1]);
    return {};
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("inline order selection", () => {
  it("inserts details after the selected row, retaining the other orders' order", async () => {
    const view = await mount();
    fireEvent.click(button("second"));
    const evidence = await screen.findByText("Evidence for second");
    const detailRow = evidence.closest("tr")!;
    expect(detailRow.previousElementSibling).toHaveTextContent("Course second");
    expect(detailRow.nextElementSibling).toHaveTextContent("Course third");
    expect(view.container.querySelector("tbody > tr:first-child")).toHaveTextContent(
      "Course first",
    );
    expect(button("second")).toHaveAttribute("aria-expanded", "true");
  });

  it("ignores an older response that finishes after the latest selection", async () => {
    const first = deferred<ReturnType<typeof detail>>();
    const fallback = api.getMockImplementation()!;
    api.mockImplementation((path: string) =>
      path === "order?id=first" ? first.promise : fallback(path),
    );
    await mount();
    fireEvent.click(button("first"));
    fireEvent.click(button("second"));
    await screen.findByText("Evidence for second");
    await act(async () => first.resolve(detail("first")));
    expect(screen.queryByText("Evidence for first")).not.toBeInTheDocument();
    expect(button("second")).toHaveAttribute("aria-expanded", "true");
  });

  it("does not reopen a dismissed row when an in-flight refresh completes", async () => {
    await mount();
    fireEvent.click(button("first"));
    await screen.findByText("Evidence for first");
    const refresh = deferred<ReturnType<typeof detail>>();
    api.mockReturnValueOnce(refresh.promise);
    fireEvent.click(button("first"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await act(async () => refresh.resolve(detail("first")));
    expect(button("first")).toHaveAttribute("aria-expanded", "false");
    const shell = screen.getByText("Evidence for first").closest(".admin-order-detail-shell");
    expect(shell).toHaveAttribute("inert");
    expect(button("first")).toHaveFocus();
  });

  it("invalidates pending details on filter changes and disables stale results while refreshing", async () => {
    const request = deferred<ReturnType<typeof detail>>();
    const list = deferred<{ items: typeof orders; total: number }>();
    const fallback = api.getMockImplementation()!;
    api.mockImplementation((path: string) => {
      if (path === "order?id=first") return request.promise;
      if (path.includes("status=paid")) return list.promise;
      return fallback(path);
    });
    await mount();
    fireEvent.click(button("first"));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "paid" } });
    expect(button("first")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Refreshing orders");
    await act(async () => {
      request.resolve(detail("first"));
      list.resolve({ items: orders, total: 3 });
    });
    expect(screen.queryByText("Evidence for first")).not.toBeInTheDocument();
    expect(button("first")).not.toBeDisabled();
  });

  it("does not remove a quickly reopened row when its earlier exit timer expires", async () => {
    await mount();
    fireEvent.click(button("first"));
    await screen.findByText("Evidence for first");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(button("first"));
    await act(async () => {});
    await act(async () => vi.advanceTimersByTimeAsync(400));
    expect(screen.getByText("Evidence for first")).toBeInTheDocument();
    expect(button("first")).toHaveAttribute("aria-expanded", "true");
  });

  it("clears collapsed content without waiting for a transition in reduced-motion mode", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    await mount();
    fireEvent.click(button("first"));
    await screen.findByText("Evidence for first");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await act(async () => vi.runOnlyPendingTimersAsync());
    expect(screen.queryByText("Evidence for first")).not.toBeInTheDocument();
    expect(button("first")).toHaveFocus();
  });

  it("allows retry after a failed filter request without enabling stale results", async () => {
    await mount();
    api.mockRejectedValueOnce(new Error("Orders unavailable"));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "paid" } });
    await screen.findByRole("alert");
    expect(button("first")).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry orders" }));
    await act(async () => {});
    expect(button("first")).not.toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not let reconciliation overwrite a different selected order", async () => {
    await mount();
    fireEvent.click(button("first"));
    await screen.findByText("Evidence for first");
    const reconcile = deferred<object>();
    const fallback = api.getMockImplementation()!;
    api.mockImplementation((path: string) =>
      path === "cashfree-reconcile" ? reconcile.promise : fallback(path),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reconcile sandbox payment" }));
    fireEvent.click(button("second"));
    await screen.findByText("Evidence for second");
    await act(async () => reconcile.resolve({}));
    expect(button("second")).toHaveAttribute("aria-expanded", "true");
    expect(button("first")).toHaveAttribute("aria-expanded", "false");
  });
});
