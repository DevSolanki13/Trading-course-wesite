import "server-only";
import { eventFingerprint, verifyCashfreeSignature } from "@/backend/security/cashfree-signature";
import { createAdminClient } from "@/backend/database/supabase";
import { requireEnv } from "@/backend/config/env";
import { CashfreeClient, cashfreeSandboxEnabled, webhookReference } from "../payments/cashfree";
import { commerceStore } from "../payments/data";
import { reconcilePayment, reconcileRefund } from "../payments/workflow";

const MAX_BODY_BYTES = 1024 * 1024;

export async function receiveCashfreeWebhook(request: Request) {
  // Live merchant keys are never accepted by this sandbox-only integration.
  if (!cashfreeSandboxEnabled())
    return Response.json({ error: "Sandbox processing not enabled" }, { status: 503 });
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
    const reference = webhookReference(payload);
    if (!reference) return Response.json({ received: true, ignored: true });
    const hash = eventFingerprint(rawBody);
    const { error } = await admin.from("webhook_events").insert({
      provider: "cashfree",
      payload_hash: hash,
      payload: reference,
      status: "received",
    });
    // A previously received but unprocessed event must be retried, not merely acknowledged.
    if (error && error.code !== "23505") throw new Error("Inbox write failed");
    const client = new CashfreeClient();
    const store = commerceStore(admin);
    try {
      if (reference.refundId)
        await reconcileRefund(client, store, reference.orderId, reference.refundId);
      else await reconcilePayment(client, store, reference.orderId);
      const saved = await admin
        .from("webhook_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("provider", "cashfree")
        .eq("payload_hash", hash);
      if (saved.error) throw new Error("INBOX_COMPLETION_FAILED");
    } catch {
      await admin
        .from("webhook_events")
        .update({ status: "failed" })
        .eq("provider", "cashfree")
        .eq("payload_hash", hash);
      return Response.json({ error: "Confirmation unavailable; retry later" }, { status: 503 });
    }
    return Response.json({ received: true, processing: "confirmed" });
  } catch {
    // Do not acknowledge lost events or log payloads containing customer data.
    return Response.json({ error: "Event storage unavailable; retry later" }, { status: 503 });
  }
}
