import { expect, type Page } from "@playwright/test";

/** Dismiss the real opening dialog as a visitor would; never disable it in the app. */
export async function dismissOpeningVideo(page: Page) {
  const intro = page.getByRole("dialog", { name: "Happy Diwali from indianXtrade" });
  await expect(intro).toBeVisible();
  await intro.getByRole("button", { name: /^(Skip|Close) video$/ }).click();
  await expect(intro).toHaveCount(0);
}

export async function openSite(page: Page, path: string) {
  const response = await page.goto(path);
  await dismissOpeningVideo(page);
  return response;
}
