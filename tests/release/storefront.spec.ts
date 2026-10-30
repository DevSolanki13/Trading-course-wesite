import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
    "/courses/market-foundations",
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
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    if (path === "/") await page.screenshot({ path: info.outputPath("home.png") });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      path,
    ).toBe(true);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    if (["/", "/courses/market-foundations", "/login", "/signup"].includes(path)) {
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

test("catalogue search, filter and disabled purchase", async ({ page }) => {
  await page.goto("/courses");
  await page.getByLabel("Search courses", { exact: true }).fill("no-such-course");
  await expect(page.getByRole("heading", { name: "No courses match that search." })).toBeVisible();
  await page.getByRole("button", { name: "Show all courses" }).click();
  await expect(page.locator(".course-card")).toHaveCount(3);
  await page.getByLabel("Your starting point").selectOption("Beginner");
  await expect(page.locator(".course-card")).toHaveCount(1);
  await page.goto("/courses/market-foundations");
  await expect(page.getByRole("link", { name: /refund/i }).first()).toHaveAttribute(
    "href",
    "/refund-policy",
  );
  const buttons = page.getByRole("button", { name: /Enrolment (opens later|not open)/ });
  await expect(buttons).toHaveCount(1);
  for (const button of await buttons.all()) {
    await expect(button).toBeDisabled();
  }
});

test("keyboard dialog closes and restores focus; theme persists", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Inside the lessons", exact: true });
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
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    current === "dark" ? "light" : "dark",
  );
});

test("mobile navigation and reduced motion", async ({ page }, info) => {
  await page.goto("/");
  const animated = await page
    .locator(".market-structure-bg svg, .market-path")
    .evaluateAll((elements) => elements.map((element) => getComputedStyle(element).animationName));
  expect(animated.every((name) => name === "none")).toBe(true);
  if (info.project.name.startsWith("mobile")) {
    const trigger = page.getByRole("button", { name: "Open navigation" });
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Courses", exact: true })
      .click();
    await expect(page).toHaveURL(/\/courses$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("form validation prevents an empty login submission", async ({ page }) => {
  let submitted = false;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/auth/login")) submitted = true;
  });
  await page.goto("/login");
  await page.locator('button[type="submit"]').click();
  expect(
    await page
      .locator('input[type="email"]')
      .evaluate((input: HTMLInputElement) => input.validity.valueMissing),
  ).toBe(true);
  expect(submitted).toBe(false);
});
