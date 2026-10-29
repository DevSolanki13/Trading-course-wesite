import "./load-env.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { checkConfiguration, isHttpsUrl } from "../config/environment.ts";

const env = process.env;
const selection = process.argv[2] ?? "read-only";
const results = [];
const record = (service, status, detail) => {
  results.push({ service, status, detail });
  console.log(`${status} ${service}: ${detail}`);
};
class ProviderError extends Error {}
async function api(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok)
    throw new ProviderError(`Provider returned HTTP ${response.status}; response body withheld`);
  return response.json();
}
function ready(service) {
  const check = checkConfiguration(service, env);
  if (check.configured) return true;
  record(
    service,
    "BLOCKED",
    [...check.missing.map((key) => `missing ${key}`), ...check.invalid].join("; "),
  );
  return false;
}
async function probe(service, callback) {
  if (!ready(service)) return;
  try {
    await callback();
  } catch (error) {
    record(
      service,
      "FAILED",
      error instanceof ProviderError
        ? error.message
        : "Request failed; verify account, network and configuration (secrets withheld)",
    );
  }
}

if (selection === "read-only") {
  await probe("supabase", async () => {
    const project = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
    const settings = await api(`${project}/auth/v1/settings`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    });
    const response = await fetch(`${project}/rest/v1/courses?select=id&limit=1`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    if (!response.ok)
      throw new ProviderError(
        `Database schema check returned HTTP ${response.status}; apply migration and check service key`,
      );
    record(
      "supabase",
      "PASS",
      "Auth API and migrated courses table reachable; this is not an auth/session test",
    );
    record(
      "google",
      settings.external?.google === true ? "PARTIAL" : "BLOCKED",
      settings.external?.google === true
        ? "Provider enabled; browser consent/callback round-trip still required"
        : "Google provider is not enabled",
    );
  });
  await probe("email", async () => {
    const domains = await api("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
    });
    const senderDomain = env.RESEND_FROM_EMAIL.split("@")[1].toLowerCase();
    const verified = domains.data?.some(
      (domain) => senderDomain === domain.name.toLowerCase() && domain.status === "verified",
    );
    record(
      "email",
      verified ? "PARTIAL" : "BLOCKED",
      verified
        ? "Sender domain verified; test email delivery still required"
        : "Sender domain absent/unverified (or outside the first API page)",
    );
  });
  for (const service of ["cashfree", "video"]) {
    if (ready(service))
      record(
        service,
        "PARTIAL",
        `Configuration present; run the explicit ${service} probe to create a sandbox artifact`,
      );
  }
} else if (selection === "cashfree") {
  await probe("cashfree", async () => {
    if (!isHttpsUrl(env.INTEGRATION_PUBLIC_URL))
      throw new ProviderError("Set INTEGRATION_PUBLIC_URL to the staging HTTPS origin");
    const origin = new URL(env.INTEGRATION_PUBLIC_URL).origin;
    const orderId = `phase0_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
    const order = await api("https://sandbox.cashfree.com/pg/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": env.CASHFREE_API_VERSION,
        "x-client-id": env.CASHFREE_CLIENT_ID,
        "x-client-secret": env.CASHFREE_CLIENT_SECRET,
        "x-idempotency-key": randomUUID(),
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: 1,
        order_currency: "INR",
        customer_details: { customer_id: "phase0_sandbox_test", customer_phone: "9999999999" },
        order_meta: {
          return_url: `${origin}/?sandbox_order=${orderId}`,
          notify_url: `${origin}/api/webhooks/cashfree`,
        },
        order_note: "Phase 0 sandbox connectivity test; no real customer",
      }),
    });
    if (!order.payment_session_id || order.order_id !== orderId)
      throw new ProviderError("Order response missing expected identifiers");
    mkdirSync("artifacts", { recursive: true });
    writeFileSync("artifacts/cashfree-sandbox-order.json", JSON.stringify(order, null, 2), {
      mode: 0o600,
    });
    record(
      "cashfree",
      "PARTIAL",
      "Sandbox order created; private response saved under ignored artifacts/. Complete sandbox payment and confirm webhook inbox separately",
    );
  });
} else if (selection === "video") {
  await probe("video", async () => {
    const playback = await api(
      `https://dev.vdocipher.com/api/videos/${encodeURIComponent(env.VDOCIPHER_TEST_VIDEO_ID)}/otp`,
      {
        method: "POST",
        headers: {
          Authorization: `Apisecret ${env.VDOCIPHER_API_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ttl: 300,
          annotate: JSON.stringify([
            {
              type: "rtext",
              text: "Phase 0 authorised playback test",
              alpha: "0.6",
              color: "0xFFFFFF",
              size: "15",
              interval: "5000",
              skip: "2000",
            },
          ]),
        }),
      },
    );
    if (!playback.otp || !playback.playbackInfo)
      throw new ProviderError("Video response missing playback credentials");
    const parameters = new URLSearchParams({
      otp: playback.otp,
      playbackInfo: playback.playbackInfo,
    });
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Private Phase 0 playback test</title><body style="background:#0b1012;color:white;font-family:Arial;padding:24px"><h1>Private DRM playback test</h1><p>Token is short-lived. Verify playback, watermark and controls on target browsers. Never publish this file.</p><iframe title="DRM test lesson" src="https://player.vdocipher.com/v2/?${parameters}" style="border:0;width:100%;max-width:960px;aspect-ratio:16/9" allow="encrypted-media; fullscreen" allowfullscreen></iframe></body></html>`;
    mkdirSync("artifacts", { recursive: true });
    writeFileSync("artifacts/vdocipher-playback.html", html, { mode: 0o600 });
    record(
      "video",
      "PARTIAL",
      "Backend OTP issued; private playback HTML saved under ignored artifacts/. Browser playback and watermark still require verification",
    );
  });
} else if (selection === "email") {
  await probe("email", async () => {
    const email = await api("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `phase0-${randomUUID()}`,
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [env.PROVIDER_TEST_EMAIL],
        subject: "Trading course website: Phase 0 email test",
        text: "This is the requested Phase 0 delivery test. No purchase was made and no action is required.",
      }),
    });
    if (!email.id) throw new ProviderError("Email response missing message ID");
    record(
      "email",
      "PARTIAL",
      "Test message accepted by Resend; confirm delivery in the recipient inbox/provider logs",
    );
  });
} else {
  console.error(
    "Unknown probe. Use providers:check, providers:cashfree, providers:video or providers:email.",
  );
  process.exit(1);
}

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  `artifacts/provider-check-${selection}.json`,
  JSON.stringify({ at: new Date().toISOString(), selection, results }, null, 2),
);
if (results.some((result) => result.status !== "PASS")) process.exitCode = 1;
