import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const results = [];
mkdirSync(".impeccable/review", { recursive: true });
try {
  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: ".impeccable/review/desktop.png" });
  await page.screenshot({ path: ".impeccable/review/desktop-full.png", fullPage: true });
  await page.getByRole("button", { name: "Inside the lessons", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.locator("#risk-input").focus();
  await page.keyboard.press("ArrowRight");
  assert.match(await page.locator(".exercise-result").textContent(), /750/);
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.screenshot({ path: ".impeccable/review/desktop-light.png" });
  const a11y = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
      localStorage.setItem("market-method-theme", value);
      window.dispatchEvent(new Event("theme-change"));
    }, theme);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
    const homeAudit = await new AxeBuilder({ page }).analyze();
    a11y.push(
      ...homeAudit.violations.map((item) => ({
        theme,
        route: "/",
        id: item.id,
        impact: item.impact,
        targets: item.nodes.map((node) => node.target),
      })),
    );
    for (const width of [1440, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of [
        "/",
        "/courses",
        "/courses/market-foundations",
        "/about",
        "/contact",
        "/refund-policy",
      ]) {
        await page.goto(`http://127.0.0.1:3000${route}`, { waitUntil: "domcontentloaded" });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );
        assert.equal(overflow, false, `${theme} ${width} ${route}: horizontal overflow`);
        results.push({ theme, width, route, overflow });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:3000/courses/market-foundations");
    const audit = await new AxeBuilder({ page }).analyze();
    a11y.push(
      ...audit.violations.map((item) => ({
        theme,
        id: item.id,
        impact: item.impact,
        targets: item.nodes.map((node) => node.target),
      })),
    );
  }
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
    localStorage.setItem("market-method-theme", "dark");
    window.dispatchEvent(new Event("theme-change"));
  });
  await page.goto("http://127.0.0.1:3000/");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: ".impeccable/review/mobile.png" });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Courses", exact: true })
    .click();
  await page.waitForURL("**/courses");
  await page.getByLabel("Search courses", { exact: true }).fill("nonexistent course");
  await page.getByRole("heading", { name: "No courses match that search." }).waitFor();
  await page.getByRole("button", { name: "Show all courses" }).click();
  assert.equal(await page.locator(".course-card").count(), 3);
  await page.getByLabel("Your starting point").selectOption("Beginner");
  assert.equal(await page.locator(".course-card").count(), 1);
  await page.goto("http://127.0.0.1:3000/courses/market-foundations");
  assert.equal(await page.locator(".mobile-purchase-bar button").isDisabled(), true);
  assert.equal(await page.locator(".mobile-course-info").isVisible(), true);
  assert.match(await page.locator(".mobile-course-info").textContent(), /two active devices/);
  assert.equal(await page.locator(".mobile-course-info a").getAttribute("href"), "/refund-policy");
  await page
    .locator(".mobile-course-info")
    .screenshot({ path: ".impeccable/review/course-mobile-info.png" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: ".impeccable/review/course-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: ".impeccable/review/course-desktop.png" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
  assert.equal(await page.locator(".hero-media, .hero-photo, .hero-video").count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => !document.querySelector("video"));
  const summary = {
    viewports: results,
    interactions: "PASS",
    runtimeErrors: errors,
    accessibility: a11y,
  };
  writeFileSync(".impeccable/review/verification.json", JSON.stringify(summary, null, 2));
  assert.deepEqual(errors, [], "Browser runtime errors");
  assert.equal(
    a11y.filter((item) => ["critical", "serious"].includes(item.impact)).length,
    0,
    JSON.stringify(a11y),
  );
  console.log(
    `PASS ${results.length} responsive route/theme checks, interactive controls, theme persistence, browser runtime and targeted accessibility audits.`,
  );
} finally {
  await browser.close();
}
