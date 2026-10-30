import { expect, test } from "@playwright/test";

test("homepage renders and theme switch persists", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Clarity before/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore courses" })).toBeVisible();

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
