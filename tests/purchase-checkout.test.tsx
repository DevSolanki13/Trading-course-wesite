import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PurchaseCheckout } from "../frontend/components/purchase-checkout";
import type { PurchaseCourse } from "../shared/purchase";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  push.mockReset();
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
