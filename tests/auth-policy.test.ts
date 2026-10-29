import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext, deviceName, isPrivileged, canManageStaff } from "../backend/auth/policy.ts";
import { openToken, sealToken, tokenDigest } from "../backend/auth/crypto.ts";

test("return paths preserve course checkout but reject external/auth/api redirects", () => {
  assert.equal(
    safeNext("/checkout?course=market-foundations"),
    "/checkout?course=market-foundations",
  );
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/%2f%2fevil.test",
    "/%0aevil",
    "/api/auth/logout",
    "/auth/callback",
    "/login",
    null,
  ])
    assert.equal(safeNext(value), "/account");
});
test("device names are derived labels rather than untrusted raw user agent strings", () => {
  assert.equal(deviceName("Mozilla Windows Chrome/123"), "Chrome on Windows");
  assert.equal(deviceName("<script>alert(1)</script>"), "Browser on device");
});
test("staff management always requires both admin role and aal2", () => {
  assert.equal(isPrivileged("student"), false);
  assert.equal(isPrivileged("support"), true);
  assert.equal(canManageStaff("support", "aal2"), false);
  assert.equal(canManageStaff("admin", "aal1"), false);
  assert.equal(canManageStaff("admin", "aal2"), true);
});
test("email verifier encryption authenticates ciphertext and never stores the raw nonce", () => {
  const sealed = sealToken("provider-token", "test-only-key");
  assert.equal(openToken(sealed, "test-only-key"), "provider-token");
  assert.notEqual(sealed, sealToken("provider-token", "test-only-key"));
  assert.throws(() => openToken(sealed, "wrong-key"));
  const tampered = Buffer.from(sealed, "base64url");
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => openToken(tampered.toString("base64url"), "test-only-key"));
  assert.equal(tokenDigest("nonce").length, 64);
  assert.notEqual(tokenDigest("nonce"), "nonce");
});
