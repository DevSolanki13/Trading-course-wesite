import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PurchaseCheckout } from "../frontend/components/purchase-checkout";
import type { PurchaseCourse } from "../shared/purchase";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
const courseFixture: PurchaseCourse = {
  id: "course-fixture",
  slug: "basic-to-advance",
  title: "Basic to Advance",
  description: "Trading education.",
  price: 199900,
  currency: "INR",
  level: "Beginner",
  language: "Hindi",
  thumbnail: null,
  owned: false,
  accessPeriod: 1,
  accessUnit: "months",
  accessExpiresAt: null,
  progress: 0,
  modules: [],
};
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  push.mockReset();
});

it("shows the saved coupon, total and support reference when QR validation is blocked", async () => {
  const request = vi.fn().mockResolvedValue({
    ok: false,
    status: 502,
    json: async () => ({
      error: "The receiving account could not be verified.",
      code: "ACCOUNT_MISMATCH",
      reference: "support-reference",
      retryable: false,
      order: {
        id: "saved-order",
        status: "pending",
        base: 199900,
        tax: 0,
        amount: 149900,
        couponCode: "NIKHIL",
      },
    }),
  });
  vi.stubGlobal("fetch", request);
  render(<PurchaseCheckout course={courseFixture} provider="upi" tax={0} />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Continue to gateway" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("support-reference"));
  expect(screen.getByRole("link", { name: "Check order status" })).toHaveAttribute(
    "href",
    "/indianxtrade-gateway/saved-order",
  );
  expect(screen.getByText("Coupon NIKHIL applied.")).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Coupon code" })).toHaveValue("NIKHIL");
  expect(screen.getByRole("textbox", { name: "Coupon code" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Resume payment setup" })).toBeDisabled();
  expect(screen.queryByRole("img", { name: /QR/ })).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
});

it("honors setup retry timing, then resumes the same saved checkout without changing its quote", async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({
      error: "Payment setup is in progress.",
      code: "SETUP_PENDING",
      retryable: true,
      retryAfter: 2,
      order: {
        id: "saved-order",
        status: "pending",
        base: 199900,
        tax: 0,
        amount: 199900,
        couponCode: null,
      },
    }),
  });
  vi.stubGlobal("fetch", request);
  render(<PurchaseCheckout course={courseFixture} provider="upi" tax={0} />);
  fireEvent.click(screen.getByRole("checkbox"));
  await act(async () => {
    const generate = screen.getByRole("button", { name: "Continue to gateway" });
    fireEvent.click(generate);
    fireEvent.click(generate);
  });
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Payment setup pending…" })).toBeDisabled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  const resume = screen.getByRole("button", { name: "Resume payment setup" });
  expect(resume).toBeEnabled();
  await act(async () => {
    fireEvent.click(resume);
  });
  expect(request).toHaveBeenCalledTimes(2);
  expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({
    courseId: courseFixture.id,
    terms: true,
  });
});

it("creates a new order when retrying a failed mock payment", async () => {
  vi.useFakeTimers();
  const request = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ order: { id: "first-order", status: "pending" } }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ order: { id: "first-order", status: "failed" } }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ order: { id: "retry-order", status: "pending" } }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ order: { id: "retry-order", status: "paid" } }),
    });
  vi.stubGlobal("fetch", request);
  const course: PurchaseCourse = {
    id: "course-fixture",
    slug: "basic-to-advance",
    title: "Basic to Advance",
    description: "Trading education.",
    price: 199900,
    currency: "INR",
    level: "Beginner",
    language: "Hindi",
    thumbnail: null,
    owned: false,
    accessPeriod: 1,
    accessUnit: "months",
    accessExpiresAt: null,
    progress: 0,
    modules: [],
  };
  render(<PurchaseCheckout course={course} provider="mock" tax={0} />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Simulate failure" }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
  expect(screen.getByRole("heading", { name: "Your payment was not completed" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Retry test payment" }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
  expect(request.mock.calls.map(([url]) => url)).toEqual([
    "/api/purchase/create",
    "/api/purchase/mock",
    "/api/purchase/create",
    "/api/purchase/mock",
  ]);
  expect(JSON.parse(request.mock.calls[3][1].body)).toEqual({
    orderId: "retry-order",
    outcome: "paid",
  });
  expect(push).toHaveBeenCalledWith("/checkout/success?orderId=retry-order");
});

it("continues to the separate gateway using the saved order without showing a QR on checkout", async () => {
  const request = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      order: {
        id: "bound-order",
        provider: "upi",
        status: "pending",
        base: 199900,
        tax: 0,
        amount: 147914,
        couponCode: "NIKHIL",
        couponDiscount: 50000,
        gatewaySavings: 1986,
        upi: { amount: 147914 },
      },
    }),
  });
  vi.stubGlobal("fetch", request);
  render(<PurchaseCheckout course={courseFixture} provider="upi" tax={0} />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Continue to gateway" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/indianxtrade-gateway/bound-order"));
  expect(screen.queryByText("Gateway savings")).toBeNull();
  expect(screen.getByText("GST (18%, reference)")).toBeVisible();
  expect(screen.getByText("₹269.82")).toBeVisible();
  expect(screen.getByText("Early bird offer")).toBeVisible();
  expect(screen.getByText("−₹500.00")).toBeVisible();
  expect(screen.getByText("−₹289.68")).toBeVisible();
  expect(screen.queryByText(/GST charged: ₹0.00/)).toBeNull();
  expect(screen.queryByRole("img", { name: /Scan to pay/ })).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
});
