import { afterEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CheckoutPage from "../app/checkout/[slug]/page";
import { POST as legacyCheckout } from "../app/api/checkout/route";
const { checkout } = vi.hoisted(() => ({ checkout: vi.fn() }));
vi.mock("../backend/payments/providers", () => ({ getCheckoutProvider: checkout }));
vi.mock("../backend/purchase/pages", () => ({
  requirePurchaseUser: async () => ({ id: "student" }),
}));
vi.mock("../backend/purchase/repository", () => ({
  purchaseCourse: async () => ({ id: "course", slug: "test-course", owned: false, price: 10000 }),
  purchaseRpc: async () => 0,
}));
vi.mock("../frontend/components/purchase-checkout", () => ({
  PurchaseCheckout: ({ provider, available }: { provider: string; available: boolean }) => (
    <div>
      <span>Pay with {provider}</span>
      <button disabled={!available}>Continue</button>
    </div>
  ),
}));
afterEach(() => checkout.mockReset());
it("shows only UPI when checkout is configured", async () => {
  checkout.mockReturnValue({ name: "upi" });
  render(await CheckoutPage({ params: Promise.resolve({ slug: "test-course" }) }));
  expect(screen.getByText("Pay with upi")).toBeVisible();
  expect(screen.getByRole("button")).toBeEnabled();
  expect(checkout).toHaveBeenCalledWith(process.env, "student");
});
it("keeps UPI unavailable instead of offering another payment method when configuration is missing", async () => {
  checkout.mockImplementation(() => {
    throw new Error("unavailable");
  });
  render(await CheckoutPage({ params: Promise.resolve({ slug: "test-course" }) }));
  expect(screen.getByText("Pay with upi")).toBeVisible();
  expect(screen.getByRole("button")).toBeDisabled();
  expect(screen.queryByText(/cashfree|razorpay|demo/i)).toBeNull();
});
it("rejects provider-specific legacy checkout creation", async () => {
  const response = await legacyCheckout();
  expect(response.status).toBe(410);
  expect((await response.json()).error).toContain("UPI");
});
