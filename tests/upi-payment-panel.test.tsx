import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  expect(screen.getByText("₹999.91")).toBeVisible();
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
  expect(refresh).toHaveBeenCalled();
});

it("shows IndianXTrade while preserving the gateway's original UPI payee parameters", async () => {
  const original = {
    ...order,
    upi: {
      ...order.upi!,
      payeeName: "ASM Trade",
      uri: "upi://pay?pa=academy%40bank&pn=ASM%20Trade&am=999.91&cu=INR&mc=1234",
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ order: original }) }),
  );
  await act(async () => {
    render(<UpiPaymentPanel order={original} />);
  });
  expect(screen.getByText("IndianXTrade", { exact: true })).toBeVisible();
  expect(screen.queryByText("ASM Trade")).toBeNull();
  expect(screen.getByRole("link", { name: "Open UPI app" })).toHaveAttribute(
    "href",
    original.upi.uri,
  );
});

it("saves an unconfirmed reference, keeps verification pending and restores it on a later visit", async () => {
  const submitted = {
    ...order,
    paymentReference: { reference: "123456789012", submittedAt: new Date().toISOString() },
  };
  const fetcher = vi.fn().mockImplementation(async (url) => ({
    ok: true,
    json: async () => ({ order: url === "/api/purchase/reference" ? submitted : order }),
  }));
  vi.stubGlobal("fetch", fetcher);
  const view = render(<UpiPaymentPanel order={order} />);
  fireEvent.click(screen.getByRole("button", { name: /Paid, but not confirmed/ }));
  fireEvent.change(screen.getByRole("textbox", { name: /UPI transaction reference/ }), {
    target: { value: "123456789012" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit reference" }));
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Reference received." })).toBeVisible(),
  );
  expect(screen.getByText("Waiting for bank verification")).toBeVisible();
  expect(screen.queryByRole("link", { name: "Start learning" })).toBeNull();
  expect(push).not.toHaveBeenCalled();
  const request = fetcher.mock.calls.find(([url]) => url === "/api/purchase/reference");
  expect(JSON.parse(request![1].body)).toEqual({ orderId: order.id, reference: "123456789012" });
  view.unmount();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ order: submitted }) }),
  );
  await act(async () => {
    render(<UpiPaymentPanel order={submitted} />);
  });
  expect(screen.getByText("123456789012")).toBeVisible();
});

it("retains the typed reference on a save failure and accepts references after QR expiry", async () => {
  const expired = {
    ...order,
    upi: { ...order.upi!, expiresAt: new Date(Date.now() - 60000).toISOString() },
  };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(async (url) =>
        url === "/api/purchase/reference"
          ? { ok: false, json: async () => ({ error: "Save unavailable. Try again." }) }
          : { ok: true, json: async () => ({ order: expired }) },
      ),
  );
  await act(async () => {
    render(<UpiPaymentPanel order={expired} />);
  });
  expect(screen.queryByRole("link", { name: "Open UPI app" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Paid, but not confirmed/ }));
  const input = screen.getByRole("textbox", { name: /UPI transaction reference/ });
  fireEvent.change(input, { target: { value: "123456789012" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit reference" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Save unavailable"));
  expect(input).toHaveValue("123456789012");
  expect(screen.queryByText("Reference received.")).toBeNull();
});
