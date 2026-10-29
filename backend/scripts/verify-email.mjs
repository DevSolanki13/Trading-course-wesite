import "./load-env.mjs";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

// Sends exactly one operator-requested test, never to generated auth fixtures.
const { RESEND_API_KEY, RESEND_FROM_EMAIL, PROVIDER_TEST_EMAIL, PROJECT_STAGE } = process.env;
if (PROJECT_STAGE !== "staging" || !RESEND_API_KEY || !RESEND_FROM_EMAIL || !PROVIDER_TEST_EMAIL)
  throw new Error("Configure staging and all three email values before testing.");
const report = {
  at: new Date().toISOString(),
  accepted: false,
  delivery: "unconfirmed",
  testSender: /@resend\.dev$/i.test(RESEND_FROM_EMAIL),
};
try {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `phase2-${randomUUID()}`,
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [PROVIDER_TEST_EMAIL],
      subject: "Market Method: Phase 2 email delivery test",
      text: "This is your requested account email delivery test. No account was created, purchase made or password changed. No action is required.",
    }),
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(`Send returned HTTP ${response.status}; provider body withheld.`);
  const { id } = await response.json();
  if (typeof id !== "string" || !/^[\w-]+$/.test(id)) throw new Error("Message ID missing.");
  report.accepted = true;
  console.log("PASS operator test message accepted by Resend (addresses and message ID withheld).");
  for (let attempt = 0; attempt < 3; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const detail = await fetch(`https://api.resend.com/emails/${id}`, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    if (!detail.ok) {
      console.log(`PARTIAL delivery lookup returned HTTP ${detail.status}; check provider logs.`);
      break;
    }
    const event = (await detail.json()).last_event;
    if (["delivered", "bounced", "complained", "failed", "delivery_delayed"].includes(event)) {
      report.delivery = event;
      break;
    }
  }
  console.log(
    `${report.delivery === "delivered" ? "PASS" : "PARTIAL"} provider delivery event: ${report.delivery}. Inbox placement is a separate operator check.`,
  );
  console.log(
    report.testSender
      ? "LIMIT Resend testing sender is configured; a verified business sender is required for other recipients."
      : "INFO business sender configured; domain verification is checked separately.",
  );
} catch (error) {
  console.error(
    error instanceof Error && /HTTP|missing/.test(error.message)
      ? error.message
      : "Email transport failed; secrets and provider body withheld.",
  );
  process.exitCode = 1;
} finally {
  mkdirSync(".impeccable/review", { recursive: true });
  writeFileSync(".impeccable/review/email-verification.json", JSON.stringify(report, null, 2));
  if (report.delivery !== "delivered") process.exitCode = 1;
}
