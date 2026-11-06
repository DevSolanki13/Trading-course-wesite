import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CheckoutForm } from "../frontend/components/checkout-form";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const props = {
  course: {
    slug: "basic-to-advance",
    title: "Basic to Advance",
    description: "Trading education in Hindi.",
  },
  totals: { basePaise: 199900, taxPaise: 0, totalPaise: 199900 },
  refundDays: 7,
  refundWatchLimit: 10,
  sandbox: true,
};
const request = vi.fn();
beforeEach(() => {
  push.mockReset();
  request.mockReset();
  vi.stubGlobal("fetch", request);
});
afterEach(() => vi.unstubAllGlobals());

it("normalizes a saved +91 number and requires consent before payment", () => {
  render(<CheckoutForm {...props} initialPhone="+918826537637" />);
  expect(screen.getByRole("textbox", { name: /Indian mobile number/ })).toHaveValue("8826537637");
  const submit = screen.getByRole("button", { name: "Continue to sandbox payment" });
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(submit).toBeEnabled();
});

it("accepts a pasted country prefix and keeps invalid numbers from starting checkout", () => {
  render(<CheckoutForm {...props} />);
  const phone = screen.getByRole("textbox", { name: /Indian mobile number/ });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(phone, { target: { value: "5123456789" } });
  expect(phone).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("button", { name: "Continue to sandbox payment" })).toBeDisabled();
  fireEvent.change(phone, { target: { value: "+91 98765 43210" } });
  expect(phone).toHaveValue("9876543210");
  expect(screen.getByRole("button", { name: "Continue to sandbox payment" })).toBeEnabled();
});

it("submits the normalized phone and consent without sending a client price", async () => {
  request.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ checkoutUrl: "/checkout/status/order-fixture" }),
  });
  render(<CheckoutForm {...props} initialPhone="09876543210" />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Continue to sandbox payment" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/checkout/status/order-fixture"));
  expect(request).toHaveBeenCalledWith("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "basic-to-advance", terms: true, phone: "9876543210" }),
  });
});

it("shows a payment error and allows retry without losing the entered number", async () => {
  request.mockResolvedValue({
    ok: false,
    status: 503,
    json: async () => ({ error: "Checkout is temporarily unavailable." }),
  });
  render(<CheckoutForm {...props} initialPhone="9876543210" />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Continue to sandbox payment" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Checkout is temporarily unavailable.",
  );
  expect(screen.getByRole("button", { name: "Continue to sandbox payment" })).toBeEnabled();
  expect(screen.getByRole("textbox", { name: /Indian mobile number/ })).toHaveValue("9876543210");
});

it("keeps demo checkout available without requiring a Cashfree phone number", async () => {
  request.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ checkoutUrl: "/demo-pay/order-fixture" }),
  });
  render(<CheckoutForm {...props} sandbox={false} />);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Continue to demo payment" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/demo-pay/order-fixture"));
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({
    slug: "basic-to-advance",
    terms: true,
  });
});
