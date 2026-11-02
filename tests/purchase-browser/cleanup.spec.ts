import { test, expect } from "@playwright/test";

test("student dashboard opens the deferred classroom and retains saved progress", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Fill demo credentials" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My courses", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Resume lesson", exact: true }).click();
  await expect(page.locator(".video-learning-page")).toBeVisible();
  const lessonTitle = await page.locator(".video-learning-page h1").innerText();
  await expect(
    page.getByRole("button", { name: "Mark complete & continue", exact: true }),
  ).toBeVisible();
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes("/api/purchase/complete") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Mark complete & continue", exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await page
    .getByRole("complementary", { name: "Course curriculum" })
    .getByRole("link")
    .filter({ hasText: lessonTitle })
    .click();
  await expect(
    page.getByRole("button", { name: "Completed · Mark incomplete", exact: true }),
  ).toBeVisible();
});

test("admin workspace loads course management and other panels on demand", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByRole("button", { name: "Fill demo credentials" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Courses", exact: true })).toBeVisible();
  await expect(page.locator(".admin-course-horizontal-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await expect(page.locator(".admin-metrics")).toBeVisible();
  await page.getByRole("button", { name: "Courses", exact: true }).click();
  await expect(page.locator(".admin-course-horizontal-card")).toHaveCount(3);
});
