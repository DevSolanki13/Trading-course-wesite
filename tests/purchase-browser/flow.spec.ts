import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Fill demo credentials" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
test("zero-env demo: login return, mock purchase, receipt, lesson completion and persisted dashboard", async ({
  page,
}) => {
  await page.goto("/courses/market-foundations");
  await page.getByRole("link", { name: "Buy now", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await page.getByRole("button", { name: "Fill demo credentials" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout\//);
  await expect(
    page.getByText("TEST MODE: no real money is charged", { exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Pay successfully", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payment confirmed" })).toBeVisible();
  const orderId = new URL(page.url()).searchParams.get("orderId")!;
  const duplicate = await page.request.post("/api/purchase/mock", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: { orderId, outcome: "paid" },
  });
  expect(duplicate.status()).toBe(200);
  await page.getByRole("link", { name: "View printable receipt" }).click();
  await expect(page.getByRole("heading", { name: "Purchase receipt" })).toBeVisible();
  await expect(page.getByText(`Order ${orderId}`, { exact: true })).toBeVisible();
  await page.goto(`/checkout/success?orderId=${orderId}`);
  await page.getByRole("link", { name: "Start learning", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mark as complete", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark as complete", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mark as incomplete", exact: true })).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Market Foundations", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("25% complete", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Purchase history", exact: true }).click();
  await expect(page.getByRole("link", { name: "Print receipt", exact: true })).toHaveCount(1);
});
test("failure and cancellation never enroll; unpublished ownership and CSRF stay protected", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("/courses/price-action");
  await page.getByRole("link", { name: "Buy now", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Simulate failure", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your payment was not completed" })).toBeVisible();
  const dashboard = await (await page.request.get("/api/purchase/dashboard")).json();
  expect(dashboard.courses.some((c: { slug: string }) => c.slug === "price-action")).toBe(false);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/courses\/price-action$/);
  const denied = await page.request.post("/api/purchase/create", {
    headers: { Origin: "https://untrusted.invalid" },
    data: { courseId: "price-action", terms: true },
  });
  expect(denied.status()).toBe(403);
  const tampered = await page.request.post("/api/purchase/create", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: { courseId: "price-action", terms: true, amount: 1 },
  });
  expect(tampered.status()).toBe(400);
  const other = await browser.newContext();
  const outsider = await other.newPage();
  const course = await (
    await outsider.request.get("http://127.0.0.1:3102/api/purchase/course?id=price-action")
  ).json();
  await outsider.goto(
    `http://127.0.0.1:3102/learn/price-action/${course.course.modules[0].lessons[1].id}`,
  );
  await expect(
    outsider.getByText("Purchase to unlock this lesson.", { exact: false }),
  ).toBeVisible();
  await other.close();
});
test("local signup starts with no purchases and refuses a client supplied role", async ({
  page,
}) => {
  const denied = await page.request.post("/api/auth/signup", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {
      email: "escalation@example.invalid",
      name: "Test",
      password: "TestPassword123",
      role: "admin",
    },
  });
  expect(denied.status()).toBe(400);
  await page.goto("/signup");
  await page.getByLabel("Full name", { exact: true }).fill("New learner");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`learner-${Date.now()}@example.invalid`);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "No courses purchased yet." })).toBeVisible();
});
test("new checkout, dashboard and player fit mobile/desktop and both themes", async ({
  page,
}, info) => {
  await login(page);
  for (const theme of ["dark", "light"]) {
    await page.evaluate((value) => {
      localStorage.setItem("market-method-theme", value);
      document.documentElement.dataset.theme = value;
      window.dispatchEvent(new Event("theme-change"));
    }, theme);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/checkout/price-action", "/dashboard", "/learn/market-foundations"]) {
        await page.goto(path);
        await expect(page.locator("main")).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        const audit = await new AxeBuilder({ page })
          .exclude("nextjs-portal")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(audit.violations).toEqual([]);
        await page.screenshot({
          path: info.outputPath(`${theme}-${width}-${path.split("/")[1]}.png`),
        });
      }
    }
  }
});
