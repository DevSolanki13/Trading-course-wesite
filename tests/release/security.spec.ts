import { expect, test } from "@playwright/test";

test("nonce CSP, private caching and staging indexing", async ({ request }) => {
  const first = await request.get("/");
  const second = await request.get("/");
  const policy = first.headers()["content-security-policy"];
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).not.toContain("unsafe-eval");
  const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  expect(await first.text()).toContain(`nonce="${nonce}"`);
  expect(second.headers()["content-security-policy"]).not.toContain(`'nonce-${nonce}'`);
  expect(first.headers()["cache-control"]).toContain("no-store");
  expect(first.headers()["x-frame-options"]).toBe("DENY");
  expect(first.headers()["x-content-type-options"]).toBe("nosniff");
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
  expect((await request.get("/not-a-page")).status()).toBe(404);
  expect((await request.get("/courses/not-a-course")).status()).toBe(404);
});

test("metadata, sitemap and social image are usable", async ({ page, request }) => {
  await page.goto("/courses/market-foundations");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/courses\/market-foundations$/,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    /Market Method/,
  );
  const image = await request.get("/opengraph-image");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  expect((await image.body()).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/courses/market-foundations");
  expect(sitemap).not.toMatch(/<loc>[^<]*\/(?:account|admin|checkout|learn|api)(?:\/|<)/);
});

test("anonymous API calls and cross-origin mutations cannot grant access", async ({ request }) => {
  for (const path of [
    "/api/learning/library",
    "/api/refunds",
    "/api/admin/overview",
    "/api/checkout/status/11111111-1111-4111-8111-111111111111",
    "/api/orders/11111111-1111-4111-8111-111111111111/document",
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  const csrf = await request.post("/api/auth/login", {
    headers: { Origin: "https://untrusted.invalid" },
    data: { email: "nobody@example.invalid", password: "unused" },
  });
  expect(csrf.status()).toBe(403);
  const checkout = await request.post("/api/checkout", {
    data: { slug: "market-foundations", terms: true },
  });
  expect(checkout.status()).toBe(404);
  for (const path of ["/api/payments/demo/simulate", "/api/payments/demo/webhook"]) {
    expect((await request.post(path, { data: {} })).status()).toBe(404);
  }
  expect((await request.post("/api/webhooks/cashfree", { data: {} })).status()).toBe(503);
  const health = await (await request.get("/api/health")).json();
  expect(health.checkoutEnabled).toBe(false);
  expect((await request.get("/api/operations/run")).status()).toBe(404);
  expect((await request.post("/api/payments/mock/success", { data: {} })).status()).toBe(404);
  expect((await request.get("/api/payments/mock/success")).status()).toBe(404);
  expect((await request.get("/pay/cashfree/11111111-1111-4111-8111-111111111111")).status()).toBe(
    404,
  );
});
