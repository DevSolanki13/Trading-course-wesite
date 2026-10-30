import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { CashfreePaymentPanel } from "../frontend/components/cashfree-payment-panel";
vi.mock("next/script", () => ({
  default: function ReadyScript({ onReady }: { onReady: () => void }) {
    useEffect(() => {
      onReady();
    }, [onReady]);
    return null;
  },
}));
afterEach(() => {
  delete (window as Window & { Cashfree?: unknown }).Cashfree;
});
it("opens only sandbox checkout with its scoped session and preserves the status link", async () => {
  const checkout = vi.fn().mockResolvedValue({});
  const factory = vi.fn(() => ({ checkout }));
  Object.assign(window, { Cashfree: factory });
  render(
    <CashfreePaymentPanel orderId="fixture-order" sessionId="fixture-session" totalPaise={12345} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Open sandbox payment" }));
  expect(factory).toHaveBeenCalledWith({ mode: "sandbox" });
  expect(checkout).toHaveBeenCalledWith({
    paymentSessionId: "fixture-session",
    redirectTarget: "_self",
  });
  expect(screen.getByRole("link", { name: "Check saved order status" })).toHaveAttribute(
    "href",
    "/checkout/status/fixture-order",
  );
});
it("reports SDK failure without treating it as a successful purchase", async () => {
  Object.assign(window, {
    Cashfree: () => ({ checkout: async () => ({ error: { message: "provider details" } }) }),
  });
  render(
    <CashfreePaymentPanel orderId="fixture-order" sessionId="fixture-session" totalPaise={12345} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Open sandbox payment" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Check your saved order"),
  );
  expect(screen.getByRole("alert")).not.toHaveTextContent("provider details");
  expect(screen.queryByText("Payment confirmed")).not.toBeInTheDocument();
});
