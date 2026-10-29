import assert from "node:assert/strict";

// No credentials, provider requests or data writes. Run after npm start.
const origin = "http://127.0.0.1:3000";
const home = await fetch(origin, { signal: AbortSignal.timeout(10000) });
assert.equal(home.status, 200);
assert.match(await home.text(), /Clarity before/);
assert.equal(home.headers.get("x-content-type-options"), "nosniff");
assert.equal(home.headers.get("x-frame-options"), "DENY");

const health = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(10000) });
assert.equal(health.status, 200);
assert.equal((await health.json()).checkoutEnabled, false);
assert.equal(health.headers.get("cache-control"), "no-store");

const webhook = await fetch(`${origin}/api/webhooks/cashfree`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
  signal: AbortSignal.timeout(10000),
});
assert.ok([401, 503].includes(webhook.status), "Unsigned webhook must fail closed");
console.log(`PASS home=200, health=200, unsigned-webhook=${webhook.status}; checkout disabled`);

for (const path of [
  "/courses",
  "/courses/market-foundations",
  "/courses/price-action",
  "/courses/risk-and-psychology",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/disclaimer",
  "/login",
]) {
  const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, path);
  assert.match(
    await response.text(),
    /noindex/,
    `${path} must not be indexed while preview content is present`,
  );
}
assert.equal((await fetch(`${origin}/courses/not-a-course`)).status, 404);
assert.equal((await fetch(`${origin}/not-a-page`)).status, 404);
assert.equal((await fetch(`${origin}/sitemap.xml`)).status, 200);
assert.match(await (await fetch(`${origin}/robots.txt`)).text(), /Disallow: \//);
console.log("PASS public routes, unknown-route 404s, sitemap and staging no-index protections");
