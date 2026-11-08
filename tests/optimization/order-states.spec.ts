import { expect, test } from "@playwright/test";

test("order loading/error recovery and frame-by-frame entry", async ({ page }, info) => {
  await page.addInitScript(
    (theme) => {
      localStorage.setItem("market-method-theme", theme);
      localStorage.setItem("indianxtrade-diwali-video-seen", "1");
    },
    info.project.name.endsWith("light") ? "light" : "dark",
  );
  const login = await page.request.post("/api/auth/login", {
    headers: { Origin: "http://127.0.0.1:3113" },
    data: { email: "admin@example.com", password: "OptimizationFixture123!" },
  });
  expect(login.ok()).toBe(true);
  await page.goto("/admin");
  await expect(page.locator(".admin-course-horizontal-card")).toHaveCount(2);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/admin/orders?*", async (route) => {
    await held;
    await route.fulfill({ status: 503, json: { error: "Fixture: temporary order read failure" } });
  });
  await page.getByRole("button", { name: "Orders", exact: true }).click();
  await expect(page.getByRole("status", { name: "Loading table data" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("orders-loading.png") });
  release();
  await expect(
    page.getByRole("alert").filter({ hasText: "temporary order read failure" }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("orders-error.png") });
  await page.unroute("**/api/admin/orders?*");
  await page.getByRole("button", { name: "Retry orders" }).click();
  const trigger = page.locator('[id^="order-trigger-"]').first();
  await expect(trigger).toBeVisible();
  await page.evaluate(() => {
    document.addEventListener("transitionrun", (event) => {
      if (
        !(event.target instanceof HTMLElement) ||
        !event.target.matches(".admin-order-detail-shell.is-open") ||
        event.target.dataset.frozen
      )
        return;
      event.target.dataset.frozen = "true";
      event.target.getAnimations().forEach((animation) => {
        animation.pause();
        animation.currentTime = 0;
      });
    });
  });
  await trigger.click();
  const shell = page.locator(".admin-order-detail-shell.is-open");
  await expect(shell).toHaveAttribute("data-frozen", "true");
  const start = await shell.evaluate((element) => element.getBoundingClientRect().height);
  await shell.evaluate((element) =>
    element.getAnimations().forEach((animation) => {
      animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
    }),
  );
  await page.screenshot({ path: info.outputPath("orders-entry-halfway.png"), fullPage: true });
  const middle = await shell.evaluate((element) => element.getBoundingClientRect().height);
  await shell.evaluate((element) =>
    element.getAnimations().forEach((animation) => {
      animation.finish();
    }),
  );
  const end = await shell.evaluate((element) => element.getBoundingClientRect().height);
  expect(start).toBeLessThan(middle);
  expect(middle).toBeLessThan(end);
  await page.screenshot({ path: info.outputPath("orders-entry-complete.png"), fullPage: true });
  await shell.getByRole("button", { name: "Close", exact: true }).click();
  await expect(trigger).toBeFocused();
  await expect(page.locator(".admin-order-detail-shell")).toHaveCount(0);
});
