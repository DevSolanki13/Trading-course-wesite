import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyCashfreeSignature,
  eventFingerprint,
} from "../backend/security/cashfree-signature.ts";

const secret = "unit-test-secret-only";
const timestamp = "1793275733000";
const raw = '{"order_amount":1.00,"type":"PAYMENT_SUCCESS_WEBHOOK"}';
const signature = createHmac("sha256", secret)
  .update(timestamp + raw)
  .digest("base64");

test("accepts the valid HMAC over the exact raw body", () => {
  assert.equal(verifyCashfreeSignature(raw, timestamp, signature, secret), true);
});
test("rejects tampering and reserialized monetary values", () => {
  assert.equal(
    verifyCashfreeSignature(JSON.stringify(JSON.parse(raw)), timestamp, signature, secret),
    false,
  );
  assert.equal(verifyCashfreeSignature(raw, timestamp + "1", signature, secret), false);
  assert.equal(verifyCashfreeSignature(raw, timestamp, signature, "wrong"), false);
});
test("rejects missing and malformed signatures without throwing", () => {
  for (const bad of [null, "", "x", "!".repeat(44), signature + "garbage"]) {
    assert.equal(verifyCashfreeSignature(raw, timestamp, bad, secret), false);
  }
});
test("fingerprints duplicate payloads consistently", () => {
  assert.equal(eventFingerprint(raw), eventFingerprint(raw));
  assert.notEqual(eventFingerprint(raw), eventFingerprint(raw + " "));
  assert.equal(eventFingerprint(raw).length, 64);
});
