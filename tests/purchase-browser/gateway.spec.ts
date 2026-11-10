import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { dismissOpeningVideo, openSite } from "../browser/support/site";

test("the dedicated charcoal gateway saves private references without confirming payment", async ({
  page,
  browser,
}, info) => {
  await openSite(page, "/login");
  await page.getByRole("button", { name: "Fill demo credentials" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await dismissOpeningVideo(page);
  const orders = (await (await page.request.get("/api/purchase/orders")).json()).orders;
  const order = orders.find(
    (o: { provider: string; status: string }) => o.provider === "upi" && o.status === "pending",
  );
  expect(order).toBeTruthy();
  const details = (await (await page.request.get(`/api/purchase/order?id=${order.id}`)).json())
    .order;
  const path = `/indianxtrade-gateway/${order.id}`;
  const outsider = await browser.newContext();
  const denied = await outsider.request.get(`http://127.0.0.1:3102${path}`, { maxRedirects: 0 });
  expect(denied.status()).toBe(307);
  expect(denied.headers().location).toContain("/login?redirect=");
  await outsider.close();
  await openSite(page, path);
  await expect(
    page.getByRole("heading", { name: "IndianXTrade Gateway", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("IndianXTrade", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open UPI app" })).toHaveAttribute(
    "href",
    details.upi.uri,
  );
  await expect(page.getByText("ASM Trade", { exact: true })).toHaveCount(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .exclude("nextjs-portal")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath(`gateway-${width}.png`), fullPage: true });
  }
  await page
    .getByRole("button", { name: "Paid, but not confirmed? Enter your transaction reference" })
    .click();
  const input = page.getByRole("textbox", { name: "UPI transaction reference (UTR)" });
  await input.fill("bad");
  await page.getByRole("button", { name: "Submit reference", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Enter 6–32" })).toBeVisible();
  await input.fill("123456789012");
  await page.getByRole("button", { name: "Submit reference", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Reference received." })).toBeVisible();
  await page.reload();
  await expect(page.getByText("123456789012", { exact: true })).toBeVisible();
  await expect(page.getByText("Waiting for bank verification", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start learning" })).toHaveCount(0);
  const saved = (await (await page.request.get(`/api/purchase/order?id=${order.id}`)).json()).order;
  expect(saved.status).toBe("pending");
  expect(saved.paymentReference.reference).toBe("123456789012");
  expect(
    (
      await new AxeBuilder({ page })
        .exclude("nextjs-portal")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("reference-submitted-mobile.png"),
    fullPage: true,
  });
});
