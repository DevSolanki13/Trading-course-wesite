import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthProvider } from "../frontend/components/auth-provider";
import { PurchaseDashboard } from "../frontend/components/purchase-dashboard";
import { AUTH_CHANGE_KEY } from "../frontend/lib/auth-events";
import type { PurchaseOrder, PurchaseUser } from "../shared/purchase";
import type { Announcement } from "../shared/announcements";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() },
  request: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => mocks.router,
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
const user: PurchaseUser = {
  id: "one",
  name: "Account One",
  email: "one@example.com",
  role: "student",
};
const notices: Announcement[] = [];
const orders: PurchaseOrder[] = [];
function tree(owner = user) {
  return (
    <AuthProvider>
      <PurchaseDashboard
        user={owner}
        courses={[]}
        allCourses={[]}
        orders={orders}
        announcements={notices}
      />
    </AuthProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.request.mockReset().mockImplementation(() => Promise.resolve(Response.json({ user })));
  vi.stubGlobal("fetch", mocks.request);
  window.history.replaceState(null, "", "/dashboard");
});
afterEach(() => vi.unstubAllGlobals());

it("hides previous-account data immediately on cross-tab invalidation, then resets on new server props", async () => {
  const view = render(tree());
  await waitFor(() =>
    expect(view.container.querySelector(".student-dashboard-page")).not.toBeNull(),
  );
  await act(async () => {});
  let finish!: (value: Response) => void;
  mocks.request.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent(window, new StorageEvent("storage", { key: AUTH_CHANGE_KEY, newValue: "changed" }));
  expect(screen.getByRole("status")).toHaveTextContent("Checking your session");
  expect(view.container.querySelector(".student-dashboard-page")).toBeNull();
  const next = { ...user, id: "two", name: "Account Two" };
  await act(async () => finish(Response.json({ user: next })));
  expect(mocks.router.refresh).toHaveBeenCalled();
  view.rerender(tree(next));
  expect(view.container.querySelector(".student-dashboard-page")).not.toBeNull();
  expect(screen.queryByText("Account One")).not.toBeInTheDocument();
});

it("preserves the device-limit redirect and displays retryable network failures instead of private data", async () => {
  const view = render(tree());
  await act(async () => {});
  mocks.request.mockResolvedValueOnce(
    Response.json({ error: "Choose a device", code: "DEVICE_LIMIT" }, { status: 409 }),
  );
  fireEvent.focus(window);
  await waitFor(() =>
    expect(mocks.router.replace).toHaveBeenCalledWith("/auth/devices?next=%2Fdashboard"),
  );
  expect(view.container.querySelector(".student-dashboard-page")).toBeNull();
  mocks.router.replace.mockClear();
  mocks.request.mockResolvedValueOnce(
    Response.json({ error: "Session service unavailable" }, { status: 503 }),
  );
  fireEvent.focus(window);
  await screen.findByText("Session service unavailable");
  expect(mocks.router.replace).not.toHaveBeenCalled();
  mocks.request.mockResolvedValueOnce(Response.json({ user }));
  fireEvent.click(screen.getByRole("button", { name: "Retry session check" }));
  await waitFor(() =>
    expect(view.container.querySelector(".student-dashboard-page")).not.toBeNull(),
  );
});
