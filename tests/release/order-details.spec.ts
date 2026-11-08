import { expect, test } from "@playwright/test";
import { openSite } from "../browser/support/site";

test.use({ reducedMotion: "no-preference" });

test("order details animate inline and return focus on close", async ({ page }, info) => {
  const theme = info.project.name.endsWith("light") ? "light" : "dark";
  await page.addInitScript((value) => localStorage.setItem("market-method-theme", value), theme);
  const orders = ["first", "second", "third"].map((id) => ({
    id,
    user_id: "fixture-student",
    course_id: id,
    course_snapshot: { title: `Course ${id}` },
    total_paise: 199900,
    status: "pending",
    created_at: "2026-11-08T00:00:00Z",
  }));
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "fixture-admin",
          name: "Administrator",
          email: "admin@example.invalid",
          role: "admin",
          aal: "aal2",
        },
      },
    }),
  );
  await page.route("**/api/admin/courses", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/admin/order-filters", (route) =>
    route.fulfill({ json: { courses: [] } }),
  );
  await page.route("**/api/admin/orders?*", (route) =>
    route.fulfill({ json: { items: orders, total: 3 } }),
  );
  await page.route("**/api/admin/order?*", (route) => {
    const id = new URL(route.request().url()).searchParams.get("id");
    return route.fulfill({
      json: {
        order: {
          ...orders.find((order) => order.id === id),
          base_paise: 199900,
          discount_paise: 0,
          tax_paise: 0,
        },
        payments: [],
        evidence: { reason: `Evidence for ${id}` },
        providerActionsAvailable: false,
      },
    });
  });
  await openSite(page, "/admin");
  await page.getByRole("button", { name: "Orders", exact: true }).click();
  const third = page.locator("tr").filter({ has: page.locator("#order-trigger-third") });
  await expect(third).toBeVisible();
  const thirdTop = () =>
    third.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  const closedTop = await thirdTop();
  const trigger = page.locator("#order-trigger-second");
  await page.evaluate(() => {
    document.addEventListener("transitionrun", (event) => {
      if (
        event.target instanceof Element &&
        event.target.matches(".admin-order-detail-shell") &&
        event.propertyName === "grid-template-rows"
      )
        document.documentElement.dataset.orderExpansionStarted = "true";
    });
  });
  await trigger.click();
  const shell = page.locator("#order-detail-second");
  await expect(shell).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-order-expansion-started", "true");
  await expect.poll(() => shell.evaluate((element) => element.getAnimations().length)).toBe(0);
  const row = shell.locator("xpath=ancestor::tr");
  await expect(row.locator("xpath=preceding-sibling::tr[1]")).toContainText("Course second");
  await expect(row.locator("xpath=following-sibling::tr[1]")).toContainText("Course third");
  expect(await thirdTop()).toBeGreaterThan(closedTop + 50);
  await page.screenshot({ path: info.outputPath("order-expanded.png"), fullPage: true });
  await shell.getByRole("button", { name: "Close", exact: true }).click();
  await expect(trigger).toBeFocused();
  await expect(shell).toHaveAttribute("inert", "");
  await expect(shell).toHaveCount(0);
  expect(Math.abs((await thirdTop()) - closedTop)).toBeLessThan(2);
});
