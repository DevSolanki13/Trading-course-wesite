import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudentAnnouncementTicker } from "../frontend/components/student/student-announcement-ticker";
import type { Announcement } from "../shared/announcements";

const announcement: Announcement = {
  id: "announcement-fixture",
  title: "New course lessons",
  content: "The new lessons are available.\nOpen My courses to continue learning.",
  category: "Learning",
  priority: "important",
  pinned: true,
  active: true,
  author_name: "Admin",
  created_at: "2026-11-06T09:00:00Z",
  updated_at: "2026-11-06T09:00:00Z",
};
let onIntersection: (entries: { isIntersecting: boolean }[]) => void;
const disconnect = vi.fn();
beforeEach(() => {
  disconnect.mockClear();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof onIntersection) {
        onIntersection = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect = disconnect;
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("dashboard announcement ticker", () => {
  it.each([{ announcements: [] }, { announcements: [{ ...announcement, active: false }] }])(
    "does not render an empty announcement strip",
    ({ announcements }) => {
      const { container } = render(<StudentAnnouncementTicker announcements={announcements} />);
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("keeps every active message and priority available to screen readers without duplicated content", () => {
    const { container } = render(
      <StudentAnnouncementTicker
        announcements={[
          announcement,
          {
            ...announcement,
            id: "second",
            title: "Scheduled maintenance",
            content: "Lessons remain available.",
            priority: "urgent",
            pinned: false,
          },
          { ...announcement, id: "inactive", title: "Old update", active: false },
        ]}
      />,
    );
    const list = within(screen.getByRole("region", { name: "Announcements" })).getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(list).toHaveTextContent("important. Pinned. New course lessons.");
    expect(list).toHaveTextContent("urgent. Scheduled maintenance.");
    expect(list).toHaveTextContent("Lessons remain available.");
    expect(screen.queryByText("Old update")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".announcement-ticker-group")).toHaveLength(2);
    expect(container.querySelector(".announcement-ticker-track")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("lets the reader pause and resume the moving strip", () => {
    render(<StudentAnnouncementTicker announcements={[announcement]} />);
    const region = screen.getByRole("region", { name: "Announcements" });
    fireEvent.click(screen.getByRole("button", { name: "Pause announcements" }));
    expect(region).toHaveAttribute("data-paused", "true");
    expect(screen.getByRole("button", { name: "Resume announcements" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Resume announcements" }));
    expect(region).toHaveAttribute("data-paused", "false");
  });

  it("suspends the loop offscreen and in a hidden tab without overriding the reader's pause", () => {
    render(<StudentAnnouncementTicker announcements={[announcement]} />);
    const region = screen.getByRole("region", { name: "Announcements" });
    act(() => onIntersection([{ isIntersecting: false }]));
    expect(region).toHaveAttribute("data-paused", "true");
    act(() => onIntersection([{ isIntersecting: true }]));
    expect(region).toHaveAttribute("data-paused", "false");
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(region).toHaveAttribute("data-paused", "true");
    fireEvent.click(screen.getByRole("button", { name: "Pause announcements" }));
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    expect(region).toHaveAttribute("data-paused", "true");
    fireEvent.click(screen.getByRole("button", { name: "Resume announcements" }));
    expect(region).toHaveAttribute("data-paused", "false");
  });

  it("updates the message list when refreshed announcements arrive", () => {
    const { rerender, unmount } = render(
      <StudentAnnouncementTicker announcements={[announcement]} />,
    );
    rerender(
      <StudentAnnouncementTicker
        announcements={[{ ...announcement, title: "Updated timetable" }]}
      />,
    );
    expect(screen.getByRole("list")).toHaveTextContent("Updated timetable");
    expect(screen.getByRole("list")).not.toHaveTextContent("New course lessons");
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
