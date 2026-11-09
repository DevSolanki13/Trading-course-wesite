import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CourseLearnersPanel } from "../frontend/components/admin/course-learners-panel";
import type { AdminLearnerPage } from "../shared/admin-learners";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../frontend/lib/admin-api", () => ({
  adminApi: mocks.api,
  when: (v: string) => v || "Not recorded",
}));
const learner = {
  id: "learner-one",
  enrollmentId: "enrollment-one",
  name: "Learner One",
  email: "one@example.invalid",
  grantedAt: "2026-01-01",
  expiresAt: null,
  active: true,
  progressPercent: 50,
  completedLessons: 1,
  totalLessons: 2,
  watchedSeconds: 15.5,
  lastActiveAt: null,
};
const page: AdminLearnerPage = {
  course: {
    id: "course-one",
    title: "Course One",
    slug: "one",
    status: "published",
    lessonCount: 2,
  },
  learners: [learner],
  total: 51,
  enrolledTotal: 75,
  page: 0,
  pageSize: 50,
};
const detail = {
  course: page.course,
  learner: {
    ...learner,
    lessons: [
      {
        lessonId: "lesson-one",
        title: "Selected lesson",
        moduleTitle: "Module",
        completed: true,
        positionSeconds: 13,
        watchedSeconds: 15.5,
        updatedAt: null,
      },
    ],
  },
};
const props = { courseId: "course-one", onBack: vi.fn(), onEdit: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.api.mockImplementation((path: string) =>
    Promise.resolve(path.includes("learnerId=") ? detail : page),
  );
});

it("fetches summaries first, selected details on demand, and preserves enrollment counts", async () => {
  render(<CourseLearnersPanel {...props} />);
  await screen.findByRole("button", { name: "Learner One" });
  expect(screen.getByText("75 enrolled · 2 published lessons")).toBeVisible();
  expect(screen.queryByText("Selected lesson")).not.toBeInTheDocument();
  expect(mocks.api.mock.calls.every(([path]) => !path.includes("learnerId="))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Learner One" }));
  await screen.findByText("Selected lesson");
  expect(mocks.api).toHaveBeenLastCalledWith(
    "course-learners?courseId=course-one&learnerId=learner-one",
  );
  fireEvent.click(screen.getByRole("button", { name: "All learners" }));
  expect(screen.getByRole("button", { name: "Learner One" })).toBeVisible();
});

it("paginates remotely and resets to page zero for search and access filters", async () => {
  render(<CourseLearnersPanel {...props} />);
  await screen.findByRole("button", { name: "Learner One" });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(mocks.api).toHaveBeenLastCalledWith(expect.stringContaining("page=1")),
  );
  await screen.findByRole("button", { name: "Learner One" });
  fireEvent.change(screen.getByPlaceholderText("Search learners"), { target: { value: "a%_ b" } });
  await waitFor(() =>
    expect(mocks.api).toHaveBeenLastCalledWith(
      "course-learners?courseId=course-one&q=a%25_+b&access=all&page=0",
    ),
  );
  fireEvent.change(screen.getByLabelText("Filter learner access"), {
    target: { value: "expired" },
  });
  await waitFor(() =>
    expect(mocks.api).toHaveBeenLastCalledWith(expect.stringContaining("access=expired&page=0")),
  );
});

it("ignores late detail responses after leaving the selected learner", async () => {
  let resolveDetail!: (value: typeof detail) => void;
  mocks.api.mockImplementation((path: string) =>
    path.includes("learnerId=")
      ? new Promise((resolve) => {
          resolveDetail = resolve;
        })
      : Promise.resolve(page),
  );
  render(<CourseLearnersPanel {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Learner One" }));
  expect(screen.getByRole("status")).toHaveTextContent("Loading lesson details");
  fireEvent.click(screen.getByRole("button", { name: "All learners" }));
  await act(async () => resolveDetail(detail));
  expect(screen.queryByText("Selected lesson")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Learner One" })).toBeVisible();
});

it("does not let a stale search response replace newer results", async () => {
  let resolveOld!: (value: AdminLearnerPage) => void;
  mocks.api.mockImplementation((path: string) =>
    path.includes("q=old")
      ? new Promise((resolve) => {
          resolveOld = resolve;
        })
      : Promise.resolve(page),
  );
  render(<CourseLearnersPanel {...props} />);
  await screen.findByRole("button", { name: "Learner One" });
  fireEvent.change(screen.getByPlaceholderText("Search learners"), { target: { value: "old" } });
  await waitFor(() => expect(resolveOld).toBeTypeOf("function"));
  fireEvent.change(screen.getByPlaceholderText("Search learners"), { target: { value: "new" } });
  await screen.findByRole("button", { name: "Learner One" });
  await act(async () => resolveOld({ ...page, learners: [{ ...learner, name: "Stale learner" }] }));
  expect(screen.queryByRole("button", { name: "Stale learner" })).not.toBeInTheDocument();
});

it("shows a detail failure with retry, and clears course data when switching courses", async () => {
  mocks.api.mockImplementation((path: string) =>
    path.includes("learnerId=")
      ? Promise.reject(new Error("Details unavailable"))
      : Promise.resolve(page),
  );
  const view = render(<CourseLearnersPanel {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Learner One" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Details unavailable");
  mocks.api.mockResolvedValue(detail);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("Selected lesson");
  mocks.api.mockReturnValue(new Promise(() => {}));
  view.rerender(<CourseLearnersPanel {...props} courseId="course-two" />);
  expect(screen.queryByText("Selected lesson")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Course One" })).not.toBeInTheDocument();
});
