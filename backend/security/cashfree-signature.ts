import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Cashfree signs the original timestamp plus unmodified raw request body. */
export function verifyCashfreeSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret: string,
): boolean {
  if (!timestamp || !/^\d{10,16}$/.test(timestamp) || !signature || !secret) return false;
  if (!/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const expected = createHmac("sha256", secret)
    .update(timestamp + rawBody)
    .digest();
  const received = Buffer.from(signature, "base64");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Replay deduplication is persisted in the database, not an in-memory set. */
export function eventFingerprint(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}
