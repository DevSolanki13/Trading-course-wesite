import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { dismissOpeningVideo, openSite } from "../browser/support/site";
async function login(page: import("@playwright/test").Page) {
  await openSite(page, "/login");
  await page.getByRole("button", { name: "Fill demo credentials" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await dismissOpeningVideo(page);
}
test("Academy offers only UPI and refuses fallback payments without a configured bank relay", async ({
  page,
}) => {
  await openSite(page, "/courses/advance-course-with-live-qna");
  await page.getByRole("link", { name: "Buy now", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await page.getByRole("button", { name: "Fill demo credentials" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout\//);
  await dismissOpeningVideo(page);
  await expect(page.getByText("Pay with UPI", { exact: true })).toBeVisible();
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Generate UPI QR", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Pay successfully" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Simulate failure" })).toHaveCount(0);
  await expect(
    page.locator('script[src*="checkout.razorpay.com"], script[src*="sdk.cashfree.com"]'),
  ).toHaveCount(0);
  const create = await page.request.post("/api/purchase/create", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: { courseId: "advance-course-with-live-qna", terms: true },
  });
  expect(create.status()).toBe(503);
  const mock = await page.request.post("/api/purchase/mock", { data: { outcome: "paid" } });
  expect(mock.status()).toBe(404);
  const legacy = await page.request.post("/api/checkout", {
    data: { slug: "advance-course-with-live-qna", terms: true },
  });
  expect(legacy.status()).toBe(410);
});
test("unconfirmed checkout never enrolls, rejects forged money and preserves ownership and CSRF checks", async ({
  page,
  browser,
}) => {
  await login(page);
  const dashboard = await (await page.request.get("/api/purchase/dashboard")).json();
  expect(
    dashboard.courses.some((c: { slug: string }) => c.slug === "advance-course-with-live-qna"),
  ).toBe(false);
  const denied = await page.request.post("/api/purchase/create", {
    headers: { Origin: "https://untrusted.invalid" },
    data: { courseId: "advance-course-with-live-qna", terms: true },
  });
  expect(denied.status()).toBe(403);
  const tampered = await page.request.post("/api/purchase/create", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: { courseId: "advance-course-with-live-qna", terms: true, amount: 1 },
  });
  expect(tampered.status()).toBe(400);
  const other = await browser.newContext();
  const outsider = await other.newPage();
  const course = await (
    await outsider.request.get(
      "http://127.0.0.1:3102/api/purchase/course?id=advance-course-with-live-qna",
    )
  ).json();
  const locked = await outsider.request.get(
    `http://127.0.0.1:3102/api/purchase/lesson?id=${course.course.modules[0].lessons[1].id}`,
  );
  expect(locked.status()).toBe(403);
  const existing = (await (await page.request.get("/api/purchase/orders")).json()).orders[0];
  expect(
    (
      await outsider.request.get(`http://127.0.0.1:3102/api/purchase/order?id=${existing.id}`)
    ).status(),
  ).toBe(401);
  await other.close();
});
test("previously confirmed purchases retain private receipts and course access", async ({
  page,
}) => {
  await login(page);
  const orders = (await (await page.request.get("/api/purchase/orders")).json()).orders;
  const paid = orders.find((order: { status: string }) => order.status === "paid");
  expect(paid).toBeTruthy();
  await openSite(page, `/checkout/success?orderId=${paid.id}`);
  await expect(page.getByRole("heading", { name: "Payment confirmed" })).toBeVisible();
  await page.getByRole("link", { name: "View printable receipt" }).click();
  await expect(page.getByRole("heading", { name: "Purchase receipt" })).toBeVisible();
  await expect(page.getByText(`Order ${paid.id}`, { exact: true })).toBeVisible();
  await openSite(page, `/checkout/success?orderId=${paid.id}`);
  await page.getByRole("link", { name: "Start learning", exact: true }).click();
  await expect(page.locator(".video-learning-page")).toBeVisible();
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
  await openSite(page, "/signup");
  await page.getByLabel("Full name", { exact: true }).fill("New learner");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`learner-${Date.now()}@example.invalid`);
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await dismissOpeningVideo(page);
  const saved = await (await page.request.get("/api/purchase/dashboard")).json();
  expect(saved.courses).toEqual([]);
  expect(saved.orders).toEqual([]);
});
test("new checkout, dashboard and player fit mobile/desktop and both themes", async ({
  page,
}, info) => {
  await login(page);
  const accessibilityFailures: {
    theme: string;
    width: number;
    path: string;
    violations: unknown[];
  }[] = [];
  for (const theme of ["dark", "light"]) {
    await page.evaluate((value) => {
      localStorage.setItem("market-method-theme", value);
      document.documentElement.dataset.theme = value;
      window.dispatchEvent(new Event("theme-change"));
    }, theme);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        "/checkout/advance-course-with-live-qna",
        "/dashboard",
        "/learn/basic-to-advance",
      ]) {
        await openSite(page, path);
        await expect(page.locator("main")).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        const audit = await new AxeBuilder({ page })
          .exclude("nextjs-portal")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        if (audit.violations.length) {
          accessibilityFailures.push({ theme, width, path, violations: audit.violations });
        }
        await page.screenshot({
          path: info.outputPath(`${theme}-${width}-${path.split("/")[1]}.png`),
        });
      }
    }
  }
  expect(accessibilityFailures).toEqual([]);
});
