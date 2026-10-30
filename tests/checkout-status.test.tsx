import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutStatus } from "../frontend/components/checkout-status";

const orderId = "11111111-1111-4111-8111-111111111111";
const fetchOrder = vi.fn();
function response(status: string) {
  return {
    ok: true,
    json: async () => ({
      order: {
        id: orderId,
        status,
        demo: true,
        course_snapshot: { slug: "test-course", title: "Test course" },
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
    vi.useFakeTimers();
    fetchOrder.mockReset();
    vi.stubGlobal("fetch", fetchOrder);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("bounds pending polling, offers Check again and never offers a second payment", async () => {
    fetchOrder.mockResolvedValue(response("pending"));
    await mount();
    expect(screen.queryByRole("link", { name: "Start learning" })).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(fetchOrder).toHaveBeenCalledTimes(40);
    expect(screen.getByText(/avoid paying twice/)).toBeVisible();
    expect(screen.queryByRole("link", { name: "Return to checkout" })).not.toBeInTheDocument();
    fetchOrder.mockResolvedValue(response("paid"));
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await act(async () => {});
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
