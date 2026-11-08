import { expect, test } from "@playwright/test";

test("homepage renders and theme switch persists", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip video" }).click();

  await expect(
    page.getByRole("heading", { name: /Learn to trade with clarity and confidence/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Enroll now/i }).first()).toBeVisible();

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
