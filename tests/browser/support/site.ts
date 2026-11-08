import { expect, type Page } from "@playwright/test";

/** Dismiss the real opening dialog as a visitor would; never disable it in the app. */
export async function dismissOpeningVideo(page: Page) {
  const intro = page.getByRole("dialog", { name: "Happy Diwali from indianXtrade" });
  // Wait for either the real first-visit dialog or the provider's returning-visit flag.
  // Dedicated greeting tests still assert first opening and keyboard replay explicitly.
  await expect
    .poll(
      async () =>
        (await intro.isVisible()) ||
        page.evaluate(() => localStorage.getItem("indianxtrade-diwali-video-seen") === "1"),
    )
    .toBe(true);
  // The provider writes its flag in the frame that schedules the React opening state.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  if (!(await intro.isVisible())) return;
  await intro.getByRole("button", { name: /^(Skip|Close) video$/ }).click();
  await expect(intro).toHaveCount(0);
}

export async function openSite(page: Page, path: string) {
  const response = await page.goto(path);
  if (path === "/courses") await page.waitForURL((url) => url.pathname !== "/courses");
  await dismissOpeningVideo(page);
  return response;
}
