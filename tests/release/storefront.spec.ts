import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { dismissOpeningVideo, openSite } from "../browser/support/site";

test.beforeEach(async ({ page }, info) => {
  const theme = info.project.name.endsWith("light") ? "light" : "dark";
  await page.addInitScript((value) => {
    if (!localStorage.getItem("market-method-theme"))
      localStorage.setItem("market-method-theme", value);
  }, theme);
});

test("public journey, legal links, responsive layout and accessibility", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of [
    "/",
    "/courses",
    "/courses/basic-to-advance",
    "/login",
    "/signup",
    "/forgot-password",
    "/about",
    "/contact",
    "/terms",
    "/privacy",
    "/refund-policy",
    "/disclaimer",
  ]) {
    const response = await openSite(page, path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    if (path === "/") await page.screenshot({ path: info.outputPath("home.png") });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      path,
    ).toBe(true);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    if (["/", "/courses/basic-to-advance", "/login", "/signup"].includes(path)) {
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      await info.attach(`accessibility-${path.replaceAll("/", "_") || "home"}`, {
        body: JSON.stringify(audit.violations, null, 2),
        contentType: "application/json",
      });
      expect(audit.violations, `${path} accessibility`).toEqual([]);
    }
  }
  expect(errors).toEqual([]);
});

test("catalogue requires sign-in and preview purchases remain disabled", async ({ page }) => {
  await openSite(page, "/courses");
  await expect(page).toHaveURL(/\/login\?redirect=.*dashboard/);
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  await openSite(page, "/courses/basic-to-advance");
  await expect(page.getByRole("link", { name: /refund/i }).first()).toHaveAttribute(
    "href",
    "/refund-policy",
  );
  const buttons = page.getByRole("button", {
    name: /Enrolment (opens later|not open)|Payments temporarily unavailable/,
  });
  await expect(buttons).toHaveCount(1);
  for (const button of await buttons.all()) {
    await expect(button).toBeDisabled();
  }
});

test("keyboard dialog closes and restores focus; theme persists", async ({ page }) => {
  await openSite(page, "/courses/basic-to-advance");
  const trigger = page.getByRole("button", { name: "Preview the lesson format", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading")).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  const current = await page.locator("html").getAttribute("data-theme");
  await page.getByRole("button", { name: /Switch to .* theme/ }).click();
  await page.reload();
  await dismissOpeningVideo(page);
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    current === "dark" ? "light" : "dark",
  );
});

test("mobile navigation and reduced motion", async ({ page }, info) => {
  await openSite(page, "/");
  const animated = await page
    .locator(".hero-annotations .annotation-draw")
    .evaluateAll((elements) => elements.map((element) => getComputedStyle(element).animationName));
  expect(animated.every((name) => name === "none")).toBe(true);
  if (info.project.name.startsWith("mobile")) {
    // The minimal landing header deliberately has no menu; secondary pages do.
    await openSite(page, "/contact");
    const trigger = page.getByRole("button", { name: "Open navigation" });
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Courses", exact: true })
      .click();
    await expect(page).toHaveURL(/\/login\?redirect=.*dashboard/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("form validation prevents an empty login submission", async ({ page }) => {
  let submitted = false;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/auth/login")) submitted = true;
  });
  await openSite(page, "/login");
  await page.locator('button[type="submit"]').click();
  expect(
    await page
      .locator('input[type="email"]')
      .evaluate((input: HTMLInputElement) => input.validity.valueMissing),
  ).toBe(true);
  expect(submitted).toBe(false);
});

test("opening video can be skipped and replayed from Happy Diwali with the keyboard", async ({
  page,
}) => {
  await page.goto("/");
  const intro = page.getByRole("dialog", { name: "Happy Diwali from indianXtrade" });
  await expect(intro).toBeVisible();
  await expect(intro.locator("video")).toHaveJSProperty("muted", true);
  await expect(intro.locator("video")).toHaveJSProperty("controls", false);
  await intro.getByRole("button", { name: "Skip video" }).click();
  const greeting = page.getByRole("button", { name: "Happy Diwali — play greeting video" });
  await greeting.focus();
  await page.keyboard.press("Enter");
  await expect(intro).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(intro).toHaveCount(0);
  await expect(greeting).toBeFocused();
});
