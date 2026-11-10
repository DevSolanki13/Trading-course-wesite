import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminWorkspace } from "../frontend/components/admin/admin-workspace";

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace,
    refresh,
  }),
}));

// Mock dynamic panel imports to keep tests fast and focused
vi.mock("../frontend/components/admin/overview-panel", () => ({
  OverviewPanel: () => <div data-testid="panel-overview">Overview Panel</div>,
}));
vi.mock("../frontend/components/admin/course-manager", () => ({
  CourseManager: () => <div data-testid="panel-courses">Course Manager</div>,
}));
vi.mock("../frontend/components/admin/students-panel", () => ({
  StudentsPanel: () => <div data-testid="panel-students">Students Panel</div>,
}));
vi.mock("../frontend/components/admin/orders-panel", () => ({
  OrdersPanel: () => <div data-testid="panel-orders">Orders Panel</div>,
}));
vi.mock("../frontend/components/admin/upi-payments-panel", () => ({
  UpiPaymentsPanel: () => <div data-testid="panel-payments">Payments Panel</div>,
}));
vi.mock("../frontend/components/admin/refunds-panel", () => ({
  RefundsPanel: () => <div data-testid="panel-refunds">Refunds Panel</div>,
}));
vi.mock("../frontend/components/admin/coupons-panel", () => ({
  CouponsPanel: () => <div data-testid="panel-coupons">Coupons Panel</div>,
}));
vi.mock("../frontend/components/admin/announcements-panel", () => ({
  AnnouncementsPanel: () => <div data-testid="panel-announcements">Announcements Panel</div>,
}));
vi.mock("../frontend/components/admin/content-panel", () => ({
  ContentPanel: () => <div data-testid="panel-content">Content Panel</div>,
}));
vi.mock("../frontend/components/admin/operations-panel", () => ({
  OperationsPanel: () => <div data-testid="panel-operations">Operations Panel</div>,
}));
vi.mock("../frontend/components/admin/team-panel", () => ({
  TeamPanel: () => <div data-testid="panel-team">Team Panel</div>,
}));
vi.mock("../frontend/components/admin/settings-panel", () => ({
  SettingsPanel: () => <div data-testid="panel-settings">Settings Panel</div>,
}));
vi.mock("../frontend/components/admin/admin-profile-panel", () => ({
  AdminProfilePanel: () => <div data-testid="panel-profile">Profile Panel</div>,
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockAdminUser() {
  mockFetch.mockImplementation(async (url: string | Request) => {
    const urlStr = typeof url === "string" ? url : url.url;
    if (urlStr.includes("/api/auth/me")) {
      return {
        ok: true,
        json: async () => ({
          user: {
            id: "admin-1",
            name: "Dev Admin",
            email: "admin@example.com",
            role: "admin",
            aal: "aal2",
          },
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  });
}

describe("Admin mobile drawer & sign-out", () => {
  it("renders menu toggle button, opens drawer with grouped nav, account links and sign out", async () => {
    mockAdminUser();
    render(<AdminWorkspace />);

    // Wait for user to load
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open navigation menu" })).toBeInTheDocument();
    });

    const menuBtn = screen.getByRole("button", { name: "Open navigation menu" });
    expect(menuBtn).toHaveAttribute("aria-expanded", "false");
    expect(menuBtn).toHaveAttribute("aria-controls", "admin-drawer");

    const drawer = document.getElementById("admin-drawer");
    expect(drawer).toHaveAttribute("role", "dialog");
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(drawer).toHaveAttribute("aria-label", "Admin navigation");
    expect(drawer).not.toHaveClass("is-open");

    // Click menu toggle to open drawer
    fireEvent.click(menuBtn);
    expect(menuBtn).toHaveAttribute("aria-expanded", "true");
    expect(drawer).toHaveClass("is-open");

    // Drawer contains grouped navigation: Workspace, Commerce, Manage
    const drawerEl = drawer!;
    expect(drawerEl.querySelector('[aria-label="Workspace navigation"]')).toBeInTheDocument();
    expect(drawerEl.querySelector('[aria-label="Commerce navigation"]')).toBeInTheDocument();
    expect(drawerEl.querySelector('[aria-label="Manage navigation"]')).toBeInTheDocument();

    // Verify Manage navigation has only Announcements and Settings on mobile drawer
    const manageNav = drawerEl.querySelector('[aria-label="Manage navigation"]')!;
    expect(manageNav).toHaveTextContent("Announcements");
    expect(manageNav).toHaveTextContent("Settings");
    expect(manageNav).not.toHaveTextContent("Site content");
    expect(manageNav).not.toHaveTextContent("Operations & audit");
    expect(manageNav).not.toHaveTextContent("Admins & Team");

    // Drawer contains storefront link and user info
    expect(drawerEl).toHaveTextContent("View storefront");
    expect(drawerEl).toHaveTextContent("Dev Admin");
    expect(drawerEl).toHaveTextContent("admin@example.com");

    // Red-marked account links are removed from the mobile drawer
    expect(drawerEl).not.toHaveTextContent("Edit profile & credentials");
    expect(drawerEl).not.toHaveTextContent("Platform settings");
    expect(drawerEl).not.toHaveTextContent("Team security & 2FA");

    // Sign out button is present in the drawer footer
    const drawerSignOut = drawerEl.querySelector(".admin-drawer-footer .admin-signout");
    expect(drawerSignOut).toBeInTheDocument();
    expect(drawerSignOut).toHaveTextContent("Sign out");
  });

  it("closes drawer when selecting a navigation view", async () => {
    mockAdminUser();
    render(<AdminWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open navigation menu" })).toBeInTheDocument();
    });

    const menuBtn = screen.getByRole("button", { name: "Open navigation menu" });
    fireEvent.click(menuBtn);
    const drawer = document.getElementById("admin-drawer")!;
    expect(drawer).toHaveClass("is-open");

    // Click on "Students" inside the drawer
    const studentsBtn = Array.from(drawer.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Students"),
    )!;
    fireEvent.click(studentsBtn);

    // Drawer is closed
    expect(drawer).not.toHaveClass("is-open");
    expect(menuBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("closes drawer on Escape key", async () => {
    mockAdminUser();
    render(<AdminWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open navigation menu" })).toBeInTheDocument();
    });

    const menuBtn = screen.getByRole("button", { name: "Open navigation menu" });
    fireEvent.click(menuBtn);
    const drawer = document.getElementById("admin-drawer")!;
    expect(drawer).toHaveClass("is-open");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(drawer).not.toHaveClass("is-open");
  });

  it("shows an inline error and does NOT navigate when /api/auth/logout fails", async () => {
    mockAdminUser();
    render(<AdminWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open navigation menu" })).toBeInTheDocument();
    });

    // Mock logout failure while keeping me endpoint functional
    mockFetch.mockImplementation(async (url: string | Request) => {
      const urlStr = typeof url === "string" ? url : url.url;
      if (urlStr.includes("/api/auth/logout")) {
        return { ok: false, status: 500, json: async () => ({ error: "Server error" }) };
      }
      if (urlStr.includes("/api/auth/me")) {
        return {
          ok: true,
          json: async () => ({
            user: {
              id: "admin-1",
              name: "Dev Admin",
              email: "admin@example.com",
              role: "admin",
              aal: "aal2",
            },
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    const menuBtn = screen.getByRole("button", { name: "Open navigation menu" });
    fireEvent.click(menuBtn);
    const drawer = document.getElementById("admin-drawer")!;

    const drawerSignOut = drawer.querySelector(".admin-drawer-footer .admin-signout")!;
    fireEvent.click(drawerSignOut);

    // Assert error message displayed
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({ method: "POST" }),
      );
      const errorEls = screen.getAllByText("Sign out failed. Please retry.");
      expect(errorEls.length).toBeGreaterThan(0);
    });

    // Router should not have navigated away
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("navigates to /login and refreshes when /api/auth/logout succeeds", async () => {
    mockAdminUser();
    render(<AdminWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open navigation menu" })).toBeInTheDocument();
    });

    mockFetch.mockImplementation(async (url: string | Request) => {
      const urlStr = typeof url === "string" ? url : url.url;
      if (urlStr.includes("/api/auth/logout")) {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    const menuBtn = screen.getByRole("button", { name: "Open navigation menu" });
    fireEvent.click(menuBtn);
    const drawer = document.getElementById("admin-drawer")!;

    const drawerSignOut = drawer.querySelector(".admin-drawer-footer .admin-signout")!;
    await act(async () => {
      fireEvent.click(drawerSignOut);
    });

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/login");
      expect(refresh).toHaveBeenCalled();
    });
  });
});
