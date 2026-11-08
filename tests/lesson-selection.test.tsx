import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StudentDashboard } from "../frontend/components/student-dashboard";
import type { PurchaseCourse, PurchaseLessonContent } from "../shared/purchase";

const { request, push } = vi.hoisted(() => ({ request: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("next/dynamic", () => ({
  default: () =>
    function Player({
      lesson,
      onLessonChange,
    }: {
      lesson: PurchaseLessonContent;
      onLessonChange: (id: string) => void;
    }) {
      return (
        <section aria-label="Lesson player">
          <p>Playing {lesson.title}</p>
          <button onClick={() => onLessonChange(lesson.id)}>Select current lesson</button>
          <button onClick={() => onLessonChange("second")}>Select next lesson</button>
        </section>
      );
    },
}));
vi.mock("../frontend/lib/use-billing-orders", () => ({
  useBillingOrders: () => ({ orders: [], syncing: false, error: "", refresh: vi.fn() }),
}));
vi.mock("../frontend/components/student/student-announcement-ticker", () => ({
  StudentAnnouncementTicker: () => null,
}));
const course: PurchaseCourse = {
  id: "course",
  slug: "course",
  title: "Fixture course",
  description: "A fixture",
  price: 199900,
  currency: "INR",
  level: "beginner",
  language: "Hindi",
  thumbnail: null,
  owned: true,
  accessPeriod: 12,
  accessUnit: "months",
  accessExpiresAt: null,
  progress: 0,
  modules: [
    {
      id: "module",
      title: "Module",
      lessons: ["first", "second"].map((id) => ({
        id,
        title: id,
        duration: 60,
        preview: false,
        completed: false,
      })),
    },
  ],
};
beforeEach(() => {
  request.mockReset().mockImplementation(async (url: string) => ({
    ok: true,
    json: async () =>
      url === "/api/announcements"
        ? { announcements: [] }
        : { lesson: { id: url.split("=")[1], title: url.split("=")[1] } },
  }));
  vi.stubGlobal("fetch", request);
});
afterEach(() => vi.unstubAllGlobals());
async function mount(expectPlayer = true) {
  render(
    <StudentDashboard
      user={{ id: "student", name: "Student", email: "student@example.invalid", role: "student" }}
      courses={[course]}
      orders={[]}
      initialCourseSlug="course"
      initialLessonId="first"
    />,
  );
  if (expectPlayer) await screen.findByText("Playing first");
}
it("keeps the loaded player when selecting its current lesson again", async () => {
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "Select current lesson" }));
  expect(screen.getByText("Playing first")).toBeVisible();
  expect(request.mock.calls.filter(([url]) => url.includes("/api/purchase/lesson"))).toHaveLength(
    1,
  );
});
it("still fetches and opens a different selected lesson", async () => {
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "Select next lesson" }));
  await screen.findByText("Playing second");
  expect(request.mock.calls.filter(([url]) => url.includes("/api/purchase/lesson"))).toHaveLength(
    2,
  );
});
it("reopens the same course after returning to the course list", async () => {
  await mount();
  fireEvent.click(screen.getByRole("tab", { name: /My courses/ }));
  fireEvent.click(screen.getByRole("heading", { name: "Fixture course", level: 4 }));
  await screen.findByText("Playing first");
  expect(request.mock.calls.filter(([url]) => url.includes("/api/purchase/lesson"))).toHaveLength(
    2,
  );
});
it("can retry a failed current-lesson request", async () => {
  const fallback = request.getMockImplementation()!;
  let failed = false;
  request.mockImplementation((url: string) => {
    if (url.includes("/api/purchase/lesson") && !failed) {
      failed = true;
      return Promise.resolve({
        ok: false,
        json: async () => ({ error: "Temporary lesson failure" }),
      });
    }
    return fallback(url);
  });
  await mount(false);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
  await screen.findByText("Playing first");
  expect(request.mock.calls.filter(([url]) => url.includes("/api/purchase/lesson"))).toHaveLength(
    2,
  );
});
