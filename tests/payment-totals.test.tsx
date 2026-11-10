import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { PaymentTotals } from "../frontend/components/payment-layout";

it.each([
  {
    base: 199900,
    couponDiscount: 0,
    gatewaySavings: 0,
    total: 199900,
    gst: "₹359.82",
    offer: "−₹359.82",
  },
  {
    base: 199900,
    couponDiscount: 50000,
    gatewaySavings: 0,
    total: 149900,
    gst: "₹269.82",
    offer: "−₹269.82",
  },
  {
    base: 199900,
    couponDiscount: 50000,
    gatewaySavings: 1986,
    total: 147914,
    gst: "₹269.82",
    offer: "−₹289.68",
  },
  {
    base: 51001,
    couponDiscount: 0,
    gatewaySavings: 0,
    total: 51001,
    gst: "₹91.80",
    offer: "−₹91.80",
  },
])("offsets the reference GST without changing the payable total: $total paise", (quote) => {
  const { container } = render(<PaymentTotals {...quote} tax={0} />);
  expect(screen.getByText("GST (18%, reference)").nextElementSibling).toHaveTextContent(quote.gst);
  expect(screen.getByText("Early bird offer").nextElementSibling).toHaveTextContent(quote.offer);
  expect(screen.getByText(/GST charged: ₹0.00/)).toBeVisible();
  const amounts = [...container.querySelectorAll("dd")].map((dd) => {
    const value = dd.textContent!.replace(/[₹,]/g, "").replace("−", "-");
    return Math.round(Number(value) * 100);
  });
  expect(amounts.slice(0, -1).reduce((sum, amount) => sum + amount, 0)).toBe(quote.total);
  expect(amounts.at(-1)).toBe(quote.total);
});

it("keeps real saved tax visible without a promotional tax offset", () => {
  render(<PaymentTotals base={199900} couponDiscount={50000} tax={26982} total={176882} />);
  expect(screen.getByText("GST").nextElementSibling).toHaveTextContent("₹269.82");
  expect(screen.queryByText("Early bird offer")).toBeNull();
  expect(screen.queryByText(/GST charged: ₹0.00/)).toBeNull();
});

it("does not invent a reference tax or offer for a fully discounted course", () => {
  render(<PaymentTotals base={199900} couponDiscount={199900} tax={0} total={0} />);
  expect(screen.getByText("GST").nextElementSibling).toHaveTextContent("₹0.00");
  expect(screen.queryByText("Early bird offer")).toBeNull();
});
