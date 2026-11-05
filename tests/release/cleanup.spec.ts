import { expect, test } from "@playwright/test";

test("public catalogue and both course actions share one authentication request", async ({
  page,
}) => {
  for (const path of ["/courses", "/courses/basic-to-advance"]) {
    let requests = 0;
    const count = (request: import("@playwright/test").Request) => {
      if (new URL(request.url()).pathname === "/api/auth/me") requests++;
    };
    page.on("request", count);
    const checked = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/auth/me",
    );
    await page.goto(path);
    await checked;
    await expect(page.locator("h1")).toBeVisible();
    await page.waitForTimeout(150);
    expect(requests).toBe(1);
    page.off("request", count);
  }
});

test("admin catalogue views and the deferred learner panel retain their controls", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "fixture-admin",
          name: "Administrator",
          email: "admin@example.invalid",
          role: "admin",
          aal: "aal2",
        },
      },
    }),
  );
  await page.route("**/api/admin/course-learners?*", (route) =>
    route.fulfill({
      json: {
        course: { id: "fixture-course", title: "Market Foundations", lessonCount: 4 },
        learners: [],
      },
    }),
  );
  await page.goto("/courses");
  await expect(page.locator(".admin-course-horizontal-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Grid", exact: true }).click();
  await expect(page.locator(".course-grid .course-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Horizontal", exact: true }).click();
  const learners = page.getByRole("button", { name: "Learners", exact: true }).first();
  await learners.focus();
  await learners.press("Enter");
  await expect(page.getByRole("heading", { name: "Market Foundations" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit course" })).toBeVisible();
  await expect(page.getByText("No matching learners.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "All courses" }).click();
  await expect(page.locator(".admin-course-horizontal-card")).toHaveCount(3);
});
