import { expect, test } from "@playwright/test";

test("rapid order switching ignores a late response with mouse and touch", async ({
  page,
}, info) => {
  await page.addInitScript(
    (theme) => {
      localStorage.setItem("market-method-theme", theme);
      localStorage.setItem("indianxtrade-diwali-video-seen", "1");
    },
    info.project.name.endsWith("light") ? "light" : "dark",
  );
  const orders = ["first", "second", "third"].map((id) => ({
    id,
    user_id: "fixture-student",
    course_id: id,
    course_snapshot: { title: `Course ${id}` },
    status: "pending",
    total_paise: 199900,
    created_at: "2026-11-09T00:00:00Z",
  }));
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: { id: "fixture-admin", email: "admin@example.invalid", role: "admin", aal: "aal2" },
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
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/admin/order?*", async (route) => {
    const id = new URL(route.request().url()).searchParams.get("id");
    if (id === "first") await delayed;
    await route.fulfill({
      json: {
        order: {
          ...orders.find((order) => order.id === id),
          base_paise: 199900,
          discount_paise: 0,
          tax_paise: 0,
        },
        payments: [],
        evidence: { reason: `Evidence ${id}` },
        providerActionsAvailable: false,
      },
    });
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Orders", exact: true }).click();
  const first = page.locator("#order-trigger-first");
  const second = page.locator("#order-trigger-second");
  if (info.project.name.startsWith("mobile")) {
    await first.tap();
    await second.tap();
  } else {
    await first.click();
    await second.click();
  }
  await expect(page.getByText("Evidence second", { exact: true })).toBeVisible();
  const late = page.waitForResponse((response) => response.url().includes("order?id=first"));
  release();
  await late;
  await expect(second).toHaveAttribute("aria-expanded", "true");
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Evidence first", { exact: true })).toHaveCount(0);
  const close = page.getByRole("button", { name: "Close", exact: true });
  if (info.project.name.startsWith("mobile")) await close.tap();
  else await close.click();
  await expect(second).toBeFocused();
  await expect(page.locator(".admin-order-detail-shell")).toHaveCount(0);
});
