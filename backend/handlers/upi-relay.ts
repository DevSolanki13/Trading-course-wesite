import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AuthError, body, failure, json, limit } from "../auth/http";
import { academyCreditMessage, upiConfig } from "../payments/upi-config";
import { parseBankSms } from "../payments/parse-bank-sms";
import { purchaseRpc } from "../purchase/repository";

const relayPayload = z.object({
  sender: z.string().min(1).max(120),
  body: z.string().min(1).max(8192),
  receivedAt: z.string().datetime({ offset: true }),
  source: z.enum(["sms-relay", "phonepe-notif"]).optional(),
  deviceLabel: z.string().max(120).optional(),
  deviceModel: z.string().max(120).optional(),
});

export async function upiRelay(request: Request) {
  const config = upiConfig();
  if (!config.enabled) return json({ error: "Bank feed is unavailable." }, 503);
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${config.secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    return json({ error: "Unauthorised." }, 401);
  try {
    await limit(request, "upi-relay", "operator", 600, 60);
    const payload = relayPayload.parse(await body(request));
    // Both sites receive only their own account's messages. Sender alone is insufficient.
    if (!academyCreditMessage(payload.sender, payload.body))
      return json({ accepted: true, matched: false }, 202);
    const parsed = parseBankSms(payload.body);
    if (
      !parsed?.isCredit ||
      !parsed.utr ||
      !Number.isSafeInteger(parsed.amountInr) ||
      parsed.amountInr < 1 ||
      parsed.amountInr > 2147483647
    )
      return json({ accepted: true, matched: false }, 202);
    const orderId = await purchaseRpc<string | null>("purchase_upi_credit", {
      p_utr: parsed.utr.toUpperCase(),
      p_amount: parsed.amountInr,
      p_received: payload.receivedAt,
      p_sender: payload.sender,
      p_body: payload.body,
    });
    return json({ accepted: true, matched: !!orderId }, 202);
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: "Malformed relay payload." }, 400);
    if (error instanceof AuthError) return failure(error);
    // Failed persistence must be retried by the phone; never acknowledge lost credits.
    console.error("UPI bank message could not be persisted; details withheld.");
    return json({ error: "Retry bank message delivery." }, 503);
  }
}
