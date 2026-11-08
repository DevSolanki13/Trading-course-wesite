import { expect, test } from "@playwright/test";

test("opening video autoplays muted, ends with a close button and replays from the greeting", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Happy Diwali from indianXtrade" });
  const video = dialog.locator("video");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Skip video" })).toBeVisible();
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeGreaterThan(0);
  expect(await video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
  expect(await video.evaluate((element: HTMLVideoElement) => element.playsInline)).toBe(true);

  // Let the real media emit ended, rather than mocking the event handler.
  await video.evaluate((element: HTMLVideoElement) => {
    element.currentTime = element.duration - 0.15;
  });
  await expect(dialog.getByRole("button", { name: "Close video" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Skip video" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close video" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".festival-video-player")).toHaveCount(0);

  const greeting = page.getByRole("button", { name: "Happy Diwali — play greeting video" });
  await greeting.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Skip video" })).toBeVisible();
  expect(await video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeLessThan(2);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(greeting).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Skip video" }).click();
  await expect(greeting).toBeFocused();

  await page.reload();
  await expect(page.getByRole("dialog", { name: "Happy Diwali from indianXtrade" })).toHaveCount(0);
});

test("mobile visitors can skip and navigate without restarting the opening video", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dialog = page.getByRole("dialog");
  const skip = dialog.getByRole("button", { name: "Skip video" });
  await expect(skip).toBeVisible();
  const bounds = await skip.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  await skip.click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.body).pointerEvents)).not.toBe("none");
  await page.getByRole("link", { name: "Contact", exact: true }).first().click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".header-lights")).toBeVisible();
});

test("a failed video can be closed without blocking access to the website", async ({ page }) => {
  await page.route("**/videos/INDIAN_X_TRADE_Single_Logo_Smooth_Outro_1080p.mp4", (route) =>
    route.abort(),
  );
  await page.goto("/about");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText("The video couldn’t load");
  await dialog.getByRole("button", { name: "Close video" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("link", { name: "indianXtrade home" }).first()).toBeFocused();
});
