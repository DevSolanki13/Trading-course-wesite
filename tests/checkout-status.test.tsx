import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutStatus } from "../frontend/components/checkout-status";

const orderId = "11111111-1111-4111-8111-111111111111";
const fetchOrder = vi.fn();
function response(status: string, fields: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      order: {
        id: orderId,
        status,
        demo: true,
        course_snapshot: { slug: "test-course", title: "Test course" },
        ...fields,
      },
    }),
  };
}
async function mount() {
  const view = render(<CheckoutStatus orderId={orderId} />);
  await act(async () => {});
  return view;
}
describe("payment confirmation recovery", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    fetchOrder.mockReset();
    vi.stubGlobal("fetch", fetchOrder);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not spend polling attempts while hidden and resumes the saved order on return", async () => {
    let visibility: DocumentVisibilityState = "hidden";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    fetchOrder.mockResolvedValue(response("pending"));
    await mount();
    await act(async () => vi.advanceTimersByTimeAsync(300_000));
    expect(fetchOrder).not.toHaveBeenCalled();
    visibility = "visible";
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => {});
    expect(fetchOrder).toHaveBeenCalledTimes(1);
    visibility = "hidden";
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => vi.advanceTimersByTimeAsync(300_000));
    expect(fetchOrder).toHaveBeenCalledTimes(1);
    fetchOrder.mockResolvedValue(response("paid"));
    visibility = "visible";
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => {});
    expect(screen.getByRole("link", { name: "Start learning" })).toBeVisible();
    expect(fetchOrder).toHaveBeenCalledTimes(2);
  });

  it("does not restart terminal-state polling when the tab becomes visible", async () => {
    fetchOrder.mockResolvedValue(response("paid"));
    await mount();
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(fetchOrder).toHaveBeenCalledTimes(1);
  });

  it("bounds pending polling, offers Check again and never offers a second payment", async () => {
    fetchOrder.mockResolvedValue(response("pending"));
    const view = await mount();
    expect(screen.queryByRole("link", { name: "Start learning" })).not.toBeInTheDocument();
    expect(view.container.querySelector(".payment-fireworks")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(fetchOrder).toHaveBeenCalledTimes(40);
    expect(screen.getByText(/avoid paying twice/)).toBeVisible();
    expect(screen.queryByRole("link", { name: "Return to checkout" })).not.toBeInTheDocument();
    fetchOrder.mockResolvedValue(response("paid"));
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await act(async () => {});
    act(() => vi.advanceTimersByTime(1));
    expect(view.container.querySelector(".payment-fireworks")).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByRole("link", { name: "Start learning" })).toHaveAttribute(
      "href",
      "/learn/test-course",
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(fetchOrder).toHaveBeenCalledTimes(41);
  });

  it.each(["failed", "cancelled", "refunded"])(
    "does not offer learning for %s and stops polling",
    async (status) => {
      fetchOrder.mockResolvedValue(response(status));
      await mount();
      expect(screen.queryByRole("link", { name: "Start learning" })).not.toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
      });
      expect(fetchOrder).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps the reference visible after an error and recovers without a new order", async () => {
    fetchOrder.mockRejectedValueOnce(new Error("Connection interrupted"));
    await mount();
    expect(screen.getByRole("alert")).toHaveTextContent("Connection interrupted");
    expect(screen.getByText(`Order reference: ${orderId}`)).toBeVisible();
    fetchOrder.mockResolvedValue(response("paid"));
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await act(async () => {});
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start learning" })).toBeVisible();
    expect(fetchOrder.mock.calls.every(([url]) => url === `/api/checkout/status/${orderId}`)).toBe(
      true,
    );
  });

  it("shows verified Cashfree failure immediately and retries the same saved checkout", async () => {
    fetchOrder.mockResolvedValue(
      response("pending", { sandbox: true, paymentStatus: "failed", canRetry: true }),
    );
    await mount();
    expect(screen.getByRole("heading", { name: "Payment failed" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Try payment again" })).toHaveAttribute(
      "href",
      `/pay/cashfree/${orderId}`,
    );
    expect(screen.getByRole("link", { name: "View billing & receipts" })).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });
    expect(fetchOrder).toHaveBeenCalledTimes(1);
    fetchOrder.mockResolvedValue(response("paid", { sandbox: true }));
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await act(async () => {});
    expect(screen.getByRole("heading", { name: "Payment confirmed" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Start learning" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Try payment again" })).not.toBeInTheDocument();
  });
  it("shows a cancelled attempt without presenting it as processing indefinitely", async () => {
    fetchOrder.mockResolvedValue(
      response("pending", { sandbox: true, paymentStatus: "cancelled", canRetry: true }),
    );
    await mount();
    expect(screen.getByRole("heading", { name: "Checkout cancelled" })).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });
    expect(fetchOrder).toHaveBeenCalledTimes(1);
  });
  it("keeps provider errors unconfirmed and offers a status check instead of a second payment", async () => {
    fetchOrder.mockResolvedValue(
      response("pending", { sandbox: true, confirmationUnavailable: true }),
    );
    await mount();
    expect(screen.getByText(/couldn’t verify the latest payment status/)).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Payment failed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Try payment again" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check again" })).toBeVisible();
  });
  it("aborts the active request and cancels polling on unmount", async () => {
    fetchOrder.mockResolvedValue(response("pending"));
    const view = await mount();
    const signal = fetchOrder.mock.calls[0][1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(fetchOrder).toHaveBeenCalledTimes(1);
  });
});
