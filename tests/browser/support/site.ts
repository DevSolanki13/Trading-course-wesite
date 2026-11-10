import { expect, type Page } from "@playwright/test";

/** Dismiss the real opening dialog as a visitor would; never disable it in the app. */
export async function dismissOpeningVideo(page: Page) {
  const intro = page.getByRole("dialog", { name: "Happy Diwali from indianXtrade" });
  // Keep the frame wait inside the navigation-aware poll: /courses can redirect while rendering.
  await page.waitForFunction(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return (
      document.querySelector(".festival-video-dialog") ||
      localStorage.getItem("indianxtrade-diwali-video-seen") === "1"
    );
  });
  if (await intro.isVisible()) await page.keyboard.press("Escape");
  await expect(intro).toHaveCount(0);
}

export async function openSite(page: Page, path: string) {
  const response = await page.goto(path);
  await dismissOpeningVideo(page);
  return response;
}
