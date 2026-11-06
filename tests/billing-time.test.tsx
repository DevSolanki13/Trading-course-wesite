import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StudentBillingPanel } from "../frontend/components/student/student-billing-panel";
import type { PurchaseOrder } from "../shared/purchase";

const order: PurchaseOrder = {
  id: "time-fixture",
  courseId: "course-fixture",
  courseTitle: "Trading course",
  slug: "course-fixture",
  userId: "user-fixture",
  amount: 199900,
  base: 199900,
  tax: 0,
  currency: "INR",
  status: "paid",
  provider: "cashfree",
  providerOrderId: null,
  createdAt: "2026-11-05T06:40:48.440514+00:00",
  paidAt: "2026-11-05T10:14:35.432729+00:00",
  accessPeriod: 1,
  accessUnit: "months",
  accessExpiresAt: null,
};
function mount(changes: Partial<PurchaseOrder> = {}) {
  return render(
    <StudentBillingPanel orders={[{ ...order, ...changes }]} onBrowseCourses={() => {}} />,
  );
}

describe("saved billing timestamps in IST", () => {
  it.each(["paid", "refunded"])(
    "shows the saved payment-completion time for %s transactions",
    (status) => {
      const { container } = mount({ status });
      const time = container.querySelector("time")!;
      expect(time).toHaveTextContent(/5 Nov 2026, 03:44\s?pm/);
      expect(time).toHaveAttribute("datetime", order.paidAt);
      expect(time).toHaveAttribute("title", "Payment confirmed (IST, UTC+05:30)");
    },
  );
  it.each(["pending", "failed", "cancelled"])(
    "uses the saved order-creation time for %s checkout",
    (status) => {
      const { container } = mount({ status, paidAt: null });
      const time = container.querySelector("time")!;
      expect(time).toHaveTextContent(/5 Nov 2026, 12:10\s?pm/);
      expect(time).toHaveAttribute("datetime", order.createdAt);
      expect(time).toHaveAttribute("title", "Order placed (IST, UTC+05:30)");
    },
  );
  it("rolls the date forward when UTC evening becomes the following day in India", () => {
    const { container } = mount({ paidAt: "2026-11-05T20:00:00Z" });
    expect(container.querySelector("time")).toHaveTextContent(/6 Nov 2026, 01:30\s?am/);
  });
  it.each([null, "invalid"])(
    "labels the creation-time fallback when payment time is %s",
    (paidAt) => {
      const { container } = mount({ paidAt });
      expect(container.querySelector("time")).toHaveAttribute("datetime", order.createdAt);
      expect(container.querySelector("time")).toHaveAttribute(
        "title",
        "Order placed (IST, UTC+05:30)",
      );
    },
  );
  it("shows an unavailable date when neither saved timestamp is valid", () => {
    const { container } = mount({ paidAt: null, createdAt: "invalid" });
    expect(screen.getByText("Date unavailable")).toBeVisible();
    expect(container.querySelector("time")).toBeNull();
  });
});
