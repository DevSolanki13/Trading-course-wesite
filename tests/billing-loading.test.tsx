import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardLoading from "../app/dashboard/loading";
import { StudentBillingPanel } from "../frontend/components/student/student-billing-panel";

const destination = vi.hoisted(() => ({ pathname: "/dashboard", query: "view=billing" }));
vi.mock("next/navigation", () => ({
  usePathname: () => destination.pathname,
  useSearchParams: () => new URLSearchParams(destination.query),
}));

describe("billing destination loading", () => {
  it.each([
    ["/dashboard", "view=billing"],
    ["/dashboard", "tab=billing"],
    ["/dashboard", "view=orders"],
    ["/dashboard", "tab=orders"],
    ["/dashboard/orders", ""],
  ])("renders the billing skeleton immediately for %s?%s", (pathname, query) => {
    Object.assign(destination, { pathname, query });
    const { container } = render(<DashboardLoading />);
    expect(screen.getByRole("heading", { name: "Billing & receipts" })).toBeInTheDocument();
    expect(screen.getByText("Loading billing & receipts…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Explore courses" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search courses")).not.toBeInTheDocument();
    expect(container.querySelector(".student-course-grid")).toBeNull();
    expect(container.querySelector(".admin-nav-group .is-active")).toHaveTextContent(
      "Billing & receipts",
    );
    expect(container.querySelectorAll(".student-billing-skeleton tbody tr")).toHaveLength(4);
  });

  it("keeps the course skeleton for Explore courses", () => {
    Object.assign(destination, { pathname: "/dashboard", query: "view=explore" });
    const { container } = render(<DashboardLoading />);
    expect(screen.getByRole("heading", { name: "Explore courses" })).toBeInTheDocument();
    expect(container.querySelector(".student-billing-skeleton")).toBeNull();
  });

  it("shows placeholders instead of empty purchase history during the initial refresh", () => {
    const { rerender } = render(
      <StudentBillingPanel orders={[]} syncing onBrowseCourses={() => {}} />,
    );
    expect(
      within(screen.getByRole("status")).getByText("Loading billing & receipts…"),
    ).toBeInTheDocument();
    expect(screen.queryByText("No purchase history found")).not.toBeInTheDocument();
    rerender(<StudentBillingPanel orders={[]} syncing={false} onBrowseCourses={() => {}} />);
    expect(screen.queryByText("Loading billing & receipts…")).not.toBeInTheDocument();
    expect(screen.getByText("No purchase history found")).toBeInTheDocument();
  });
});
