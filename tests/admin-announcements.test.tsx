import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnouncementsPanel } from "../frontend/components/admin/announcements-panel";
import type { Announcement } from "../shared/announcements";

const notices = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: notices }));
const request = vi.fn();
const announcement: Announcement = {
  id: "notice-fixture",
  title: "New lessons",
  content: "Open My courses to continue learning.",
  category: "Curriculum",
  priority: "important",
  pinned: true,
  active: true,
  author_name: "Admin",
  created_at: "2026-11-06T22:00:00Z",
  updated_at: "2026-11-06T22:00:00Z",
};
const response = (data: unknown, ok = true) => ({ ok, json: async () => data });
async function mount(items: Announcement[] = [announcement]) {
  request.mockResolvedValue(response({ announcements: items }));
  const view = render(<AnnouncementsPanel />);
  await waitFor(() =>
    expect(screen.queryByRole("status", { name: "Loading announcements" })).not.toBeInTheDocument(),
  );
  return view;
}
function compose() {
  fireEvent.click(screen.getAllByRole("button", { name: "New announcement" })[0]);
}
function fill() {
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "  Live lesson  " } });
  fireEvent.change(screen.getByLabelText("Ticker message"), {
    target: { value: "  Join us\nthis Friday.  " },
  });
}
function posted() {
  return request.mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([, init]) => JSON.parse(init.body));
}
beforeEach(() => {
  vi.clearAllMocks();
  request.mockReset();
  vi.stubGlobal("fetch", request);
});
afterEach(() => vi.unstubAllGlobals());

describe("announcement ticker management", () => {
  it("previews only active messages using the student ticker and shows saved IST dates", async () => {
    const { container } = await mount([
      announcement,
      { ...announcement, id: "hidden", title: "Hidden notice", active: false },
    ]);
    const preview = within(container.querySelector(".announcement-ticker")! as HTMLElement);
    expect(preview.getByRole("list")).toHaveTextContent("New lessons");
    expect(preview.getByRole("list")).not.toHaveTextContent("Hidden notice");
    expect(screen.getByText("1 active · 1 hidden")).toBeInTheDocument();
    expect(screen.getAllByText("7 Nov 2026")).toHaveLength(2);
    expect(container.querySelector(".student-announcement-preview-card")).toBeNull();
  });

  it("updates the draft ticker with title, normalized message, priority, and pin status", async () => {
    const { container } = await mount();
    compose();
    fill();
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "urgent" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Pin to front/ }));
    const list = within(container.querySelector(".announcement-ticker")! as HTMLElement).getByRole(
      "list",
    );
    expect(list).toHaveTextContent("urgent. Pinned. Live lesson.");
    expect(list).toHaveTextContent("Join us this Friday.");
    expect(screen.getByText(/Line breaks become spaces/)).toBeInTheDocument();
    expect(screen.getByText("Only you can see this draft")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause announcements" }));
    expect(container.querySelector(".announcement-ticker")).toHaveAttribute("data-paused", "true");
    expect(posted()).toHaveLength(0);
  });

  it("publishes the existing API fields and returns to the published ticker preview", async () => {
    await mount();
    compose();
    fill();
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Live Session" } });
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "urgent" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Pin to front/ }));
    const created = {
      ...announcement,
      id: "created",
      title: "Live lesson",
      content: "Join us\nthis Friday.",
      category: "Live Session",
      priority: "urgent",
      pinned: true,
    };
    request.mockImplementation((_, init) =>
      Promise.resolve(
        init?.method === "POST"
          ? response({ announcement: created })
          : response({ announcements: [created, announcement] }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish to ticker" }));
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument(),
    );
    expect(posted()).toEqual([
      {
        action: "create",
        title: "Live lesson",
        content: "Join us\nthis Friday.",
        category: "Live Session",
        priority: "urgent",
        pinned: true,
      },
    ]);
    await screen.findByText("Live lesson", { selector: "h4" });
    expect(notices.success).toHaveBeenCalledWith("Announcement published to the student ticker.");
  });

  it("removes hidden messages from the preview and adds them back when shown", async () => {
    const { container } = await mount();
    request.mockResolvedValue(response({ announcement }));
    fireEvent.click(screen.getByRole("button", { name: "Hide New lessons" }));
    await screen.findByRole("button", { name: "Show New lessons" });
    expect(container.querySelector(".announcement-ticker")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show New lessons" }));
    await screen.findByRole("button", { name: "Hide New lessons" });
    expect(container.querySelector(".announcement-ticker")).not.toBeNull();
    expect(posted()).toEqual([
      { action: "update", id: announcement.id, active: false },
      { action: "update", id: announcement.id, active: true },
    ]);
  });

  it("requires the existing confirmation before deleting a message", async () => {
    await mount();
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);
    fireEvent.click(screen.getByRole("button", { name: "Delete New lessons" }));
    expect(posted()).toHaveLength(0);
    confirm.mockReturnValue(true);
    request.mockResolvedValue(response({ success: true }));
    fireEvent.click(screen.getByRole("button", { name: "Delete New lessons" }));
    await screen.findByText("No announcements yet");
    expect(posted()).toEqual([{ action: "delete", id: announcement.id }]);
  });

  it("shows fetch errors and supports retry instead of claiming there are no announcements", async () => {
    request.mockResolvedValue(response({ error: "Temporarily unavailable" }, false));
    render(<AnnouncementsPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Temporarily unavailable");
    expect(screen.queryByText("No announcements yet")).not.toBeInTheDocument();
    request.mockResolvedValue(response({ announcements: [announcement] }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("button", { name: "Hide New lessons" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("retains the draft when publishing fails", async () => {
    await mount();
    compose();
    fill();
    request.mockResolvedValue(response({ error: "Could not publish" }, false));
    fireEvent.click(screen.getByRole("button", { name: "Publish to ticker" }));
    await waitFor(() => expect(notices.error).toHaveBeenCalledWith("Could not publish"));
    expect(screen.getByLabelText("Title")).toHaveValue("  Live lesson  ");
    expect(screen.getByLabelText("Ticker message")).toHaveValue("  Join us\nthis Friday.  ");
  });

  it("keeps loading distinct from empty history", async () => {
    let resolve!: (value: unknown) => void;
    request.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<AnnouncementsPanel />);
    expect(screen.getByRole("status", { name: "Loading announcements" })).toBeInTheDocument();
    expect(screen.queryByText("No announcements yet")).not.toBeInTheDocument();
    await act(async () => resolve(response({ announcements: [] })));
    expect(screen.getByText("No announcements yet")).toBeInTheDocument();
  });
});
