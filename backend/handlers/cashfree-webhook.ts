import "server-only";
import { eventFingerprint, verifyCashfreeSignature } from "@/backend/security/cashfree-signature";
import { createAdminClient } from "@/backend/database/supabase";
import { requireEnv } from "@/backend/config/env";

const MAX_BODY_BYTES = 1024 * 1024;

export async function receiveCashfreeWebhook(request: Request) {
  // There is intentionally no checkout or enrollment mutation in Phase 0.
  let secret: string;
  try {
    secret = requireEnv("CASHFREE_CLIENT_SECRET");
  } catch {
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Empty body" }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return Response.json({ error: "Payload too large" }, { status: 413 });
      }
      chunks.push(value);
    }
  } catch {
    return Response.json({ error: "Unreadable body" }, { status: 400 });
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  if (
    !verifyCashfreeSignature(
      rawBody,
      request.headers.get("x-webhook-timestamp"),
      request.headers.get("x-webhook-signature"),
      secret,
    )
  ) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Response.json({ error: "Invalid event" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("webhook_events").insert({
      provider: "cashfree",
      payload_hash: eventFingerprint(rawBody),
      payload,
      status: "received",
    });
    // An existing inbox entry is durably recorded, so acknowledge the retry.
    if (error && error.code !== "23505") throw new Error("Inbox write failed");
    return Response.json({ received: true, processing: "not_implemented" });
  } catch {
    // Do not acknowledge lost events or log payloads containing customer data.
    return Response.json({ error: "Event storage unavailable; retry later" }, { status: 503 });
  }
}
