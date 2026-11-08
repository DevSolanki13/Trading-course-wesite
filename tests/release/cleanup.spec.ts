import { expect, test } from "@playwright/test";
import { openSite } from "../browser/support/site";

test("landing and course actions share one authentication request per public page", async ({
  page,
}) => {
  // /courses now redirects through the private dashboard; measure stable public pages.
  for (const path of ["/", "/courses/basic-to-advance"]) {
    let requests = 0;
    const count = (request: import("@playwright/test").Request) => {
      if (new URL(request.url()).pathname === "/api/auth/me") requests++;
    };
    page.on("request", count);
    const checked = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/auth/me",
    );
    await openSite(page, path);
    await checked;
    await expect(page.locator("h1")).toBeVisible();
    await page.waitForTimeout(150);
    expect(requests).toBe(1);
    page.off("request", count);
  }
});

test("admin workspace course management opens the deferred learner panel", async ({ page }) => {
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
  await page.route("**/api/admin/courses", (route) =>
    route.fulfill({
      json: {
        items: ["Market Foundations", "Price Action"].map((title, index) => ({
          id: `fixture-course-${index}`,
          title,
          slug: `fixture-course-${index}`,
          status: "published",
          price_paise: 199900,
          sale_price_paise: null,
          access_period: 12,
          access_unit: "months",
          thumbnail_url: null,
          artwork: "foundations",
          version: 1,
          created_at: "2026-11-01T00:00:00Z",
          updated_at: "2026-11-01T00:00:00Z",
        })),
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
  await openSite(page, "/admin");
  await expect(page.locator(".admin-course-horizontal-card")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "New course", exact: true })).toBeVisible();
  const learners = page.getByRole("button", { name: "Learners", exact: true }).first();
  await learners.focus();
  await learners.press("Enter");
  await expect(page.getByRole("heading", { name: "Market Foundations" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit course" })).toBeVisible();
  await expect(page.getByText("No matching learners.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "All courses" }).click();
  await expect(page.locator(".admin-course-horizontal-card")).toHaveCount(2);
});
