import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../frontend/components/auth-provider";
import { AdminWorkspace } from "../frontend/components/admin/admin-workspace";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() },
  request: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin", useRouter: () => mocks.router }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("../frontend/components/mfa-panel", () => ({
  MfaPanel: () => <p>Authenticator fixture</p>,
}));
const admin = {
  id: "staff",
  name: "Staff",
  email: "staff@example.com",
  role: "admin",
  aal: "aal2",
};
function Header() {
  const auth = useAuth();
  return <output aria-label="Identity">{auth.user?.name || "Anonymous"}</output>;
}
function mount() {
  return render(
    <AuthProvider>
      <Header />
      <AdminWorkspace />
    </AuthProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.request
    .mockReset()
    .mockImplementation(() => Promise.resolve(Response.json({ user: admin })));
  vi.stubGlobal("fetch", mocks.request);
  window.history.replaceState(null, "", "/admin");
});
afterEach(() => vi.unstubAllGlobals());

it("shares exactly one identity request between the admin workspace and header", async () => {
  mount();
  await screen.findByLabelText("Current workspace: Admin");
  expect(screen.getByLabelText("Identity")).toHaveTextContent("Staff");
  expect(mocks.request.mock.calls.map(([url]) => url)).toEqual(["/api/auth/me"]);
});

it("keeps support navigation and the authenticator gate intact", async () => {
  mocks.request.mockResolvedValueOnce(
    Response.json({ user: { ...admin, role: "support", aal: "aal1" } }),
  );
  mount();
  await screen.findByRole("heading", { name: "Verify your authenticator." });
  expect(screen.getByText("Authenticator fixture")).toBeVisible();
  expect(screen.queryByLabelText("Current workspace: Admin")).not.toBeInTheDocument();
  mocks.request.mockResolvedValueOnce(Response.json({ user: { ...admin, role: "support" } }));
  fireEvent.focus(window);
  await screen.findByLabelText("Current workspace: Admin");
  for (const button of screen.getAllByRole("button", { name: "Overview", exact: true }))
    expect(button).toHaveAttribute("aria-current", "page");
  expect(screen.queryByRole("button", { name: "Courses", exact: true })).not.toBeInTheDocument();
});

it.each([
  [401, "SESSION_REVOKED", "/admin/login?next=%2Fadmin"],
  [409, "DEVICE_LIMIT", "/auth/devices?next=%2Fadmin"],
])("preserves %s/%s redirects without a second identity fetch", async (status, code, target) => {
  mocks.request.mockResolvedValueOnce(
    Response.json({ error: "Session unavailable", code }, { status }),
  );
  mount();
  await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith(target));
  expect(mocks.request).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText("Current workspace: Admin")).not.toBeInTheDocument();
});

it("removes staff UI after focus discovers revocation and preserves blocked-account errors", async () => {
  mount();
  await screen.findByLabelText("Current workspace: Admin");
  mocks.request.mockResolvedValueOnce(
    Response.json({ error: "Account blocked", code: "ACCOUNT_BLOCKED" }, { status: 403 }),
  );
  fireEvent.focus(window);
  await screen.findByRole("alert");
  expect(screen.getByRole("alert")).toHaveTextContent("Account blocked");
  expect(screen.queryByLabelText("Current workspace: Admin")).not.toBeInTheDocument();
});

it("never renders staff controls for a student account", async () => {
  mocks.request.mockResolvedValueOnce(Response.json({ user: { ...admin, role: "student" } }));
  mount();
  await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/account"));
  expect(screen.queryByLabelText("Current workspace: Admin")).not.toBeInTheDocument();
  await act(async () => {});
});
