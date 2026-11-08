import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PurchaseConfirmation } from "../frontend/components/purchase-confirmation";
import type { PurchaseOrder } from "../shared/purchase";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const order: PurchaseOrder = {
  id: "11111111-1111-4111-8111-111111111111",
  courseId: "course",
  slug: "price-action",
  courseTitle: "Price action",
  userId: "student",
  amount: 199900,
  tax: 0,
  base: 199900,
  currency: "INR",
  status: "paid",
  provider: "upi",
  providerOrderId: null,
  createdAt: "2026-11-08T00:00:00Z",
  paidAt: "2026-11-08T00:01:00Z",
  accessPeriod: 12,
  accessUnit: "months",
  accessExpiresAt: null,
};

describe("verified payment celebration", () => {
  let reducedMotion = false;

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    reducedMotion = false;
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: reducedMotion,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(["pending", "failed", "cancelled", "refunded"])(
    "never celebrates a %s order",
    (status) => {
      const { container } = render(<PurchaseConfirmation order={{ ...order, status }} />);
      act(() => vi.advanceTimersByTime(1));
      expect(container.querySelector(".payment-fireworks")).toBeNull();
    },
  );

  it("does not celebrate an expired purchase", () => {
    const { container } = render(<PurchaseConfirmation order={order} expired />);
    expect(container.querySelector(".payment-fireworks")).toBeNull();
    expect(screen.getByRole("link", { name: "Renew course access" })).toBeVisible();
  });

  it("celebrates once in Strict Mode, finishes, and does not replay for the same order", () => {
    const view = render(
      <StrictMode>
        <PurchaseConfirmation order={order} />
      </StrictMode>,
    );
    act(() => vi.advanceTimersByTime(1));
    expect(view.container.querySelector(".payment-fireworks")).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(view.container.querySelector(".payment-fireworks")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByRole("link", { name: "Start learning" })).toHaveAttribute(
      "href",
      "/learn/price-action",
    );
    act(() => vi.advanceTimersByTime(3000));
    expect(view.container.querySelector(".payment-fireworks")).not.toHaveAttribute("data-active");
    view.unmount();
    const revisit = render(<PurchaseConfirmation order={order} />);
    act(() => vi.advanceTimersByTime(1));
    expect(revisit.container.querySelector(".payment-fireworks")).not.toHaveAttribute(
      "data-active",
    );
  });

  it("respects reduced motion and still exposes the payment confirmation", () => {
    reducedMotion = true;
    const { container } = render(<PurchaseConfirmation order={order} />);
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector(".payment-fireworks")).not.toHaveAttribute("data-active");
    expect(screen.getByRole("heading", { name: "Payment confirmed" })).toBeVisible();
  });

  it("starts only when pending becomes paid and stops when the tab is hidden", () => {
    const view = render(<PurchaseConfirmation order={{ ...order, status: "pending" }} />);
    expect(view.container.querySelector(".payment-fireworks")).toBeNull();
    view.rerender(<PurchaseConfirmation order={order} />);
    act(() => vi.advanceTimersByTime(1));
    expect(view.container.querySelector(".payment-fireworks")).toHaveAttribute(
      "data-active",
      "true",
    );
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(view.container.querySelector(".payment-fireworks")).not.toHaveAttribute("data-active");
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps confirmation usable when session storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { container } = render(<PurchaseConfirmation order={order} />);
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector(".payment-fireworks")).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("link", { name: "Start learning" })).toBeVisible();
  });
});
