import { expect, test } from "@playwright/test";
import { dismissOpeningVideo, openSite } from "../browser/support/site";

test("signed-in catalogue search and difficulty filters work in the student workspace", async ({
  page,
}) => {
  await openSite(page, "/login");
  await page.getByRole("button", { name: "Fill demo credentials" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await dismissOpeningVideo(page);
  await page.getByRole("tab", { name: "Explore courses", exact: true }).click();
  const cards = page.locator(".student-explore-card");
  await expect(cards).toHaveCount(2);
  await page.getByLabel("Search courses", { exact: true }).fill("no-such-course");
  await expect(page.getByRole("heading", { name: "No courses match your query" })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(cards).toHaveCount(2);
  await page.getByLabel("Filter courses by difficulty level").selectOption("beginner");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Basic to Advance");
  await page.getByLabel("Filter courses by difficulty level").selectOption("advanced");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Advance course with Live QNA");
});
