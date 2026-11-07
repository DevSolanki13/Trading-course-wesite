import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UpiPaymentPanel } from "../frontend/components/upi-payment-panel";
import type { PurchaseOrder } from "../shared/purchase";
const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const router = { push, refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("qrcode", () => ({ default: { toDataURL: async () => "data:image/png;base64,test" } }));
const order = {
  id: "upi-order",
  status: "pending",
  provider: "upi",
  amount: 99991,
  upi: {
    vpa: "academy@bank",
    payeeName: "Academy",
    amount: 99991,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  },
} as PurchaseOrder;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("shows the authoritative paise amount and only polls the authenticated saved order", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ order }) });
  vi.stubGlobal("fetch", fetcher);
  await act(async () => {
    render(<UpiPaymentPanel order={order} />);
  });
  const link = screen.getByRole("link", { name: "Open UPI app" });
  expect(link.getAttribute("href")).toContain("am=999.91");
  expect(screen.getByRole("heading", { name: /999.91/ })).toBeVisible();
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["/api/purchase/order?id=upi-order"]);
});
it("hides expired payment links even when the network is unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
  await act(async () => {
    render(
      <UpiPaymentPanel
        order={{
          ...order,
          upi: { ...order.upi!, expiresAt: new Date(Date.now() - 60000).toISOString() },
        }}
      />,
    );
  });
  expect(screen.queryByRole("link", { name: "Open UPI app" })).toBeNull();
  expect(screen.getByText(/This QR has expired/)).toBeVisible();
});
it("opens course confirmation only after the server reports paid", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ order: { ...order, status: "paid" } }) }),
  );
  await act(async () => {
    render(<UpiPaymentPanel order={order} />);
  });
  expect(push).toHaveBeenCalledWith("/checkout/success?orderId=upi-order");
});
