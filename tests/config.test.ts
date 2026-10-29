import { test } from "node:test";
import assert from "node:assert/strict";
import { checkConfiguration, readiness } from "../backend/config/environment.ts";

test("empty and placeholder credentials are not configuration", () => {
  assert.equal(
    readiness({}).every((check) => !check.configured),
    true,
  );
  assert.equal(
    checkConfiguration("video", {
      VDOCIPHER_API_SECRET: "your-secret",
      VDOCIPHER_TEST_VIDEO_ID: "example",
    }).configured,
    false,
  );
});

test("Phase 0 refuses production Cashfree configuration", () => {
  const env = {
    CASHFREE_ENV: "production",
    CASHFREE_CLIENT_ID: "test-id",
    CASHFREE_CLIENT_SECRET: "test-secret",
    CASHFREE_API_VERSION: "2026-01-01",
  };
  assert.equal(checkConfiguration("cashfree", env).configured, false);
  assert.equal(
    checkConfiguration("cashfree", { ...env, CASHFREE_ENV: "sandbox" }).configured,
    true,
  );
});

test("readiness reports key names and never their values", () => {
  const result = readiness({ VDOCIPHER_API_SECRET: "private-value-for-test" });
  assert.equal(JSON.stringify(result).includes("private-value-for-test"), false);
});

test("Google flag alone does not count as a working configuration", () => {
  assert.equal(checkConfiguration("google", { GOOGLE_OAUTH_CONFIGURED: "true" }).configured, false);
});

test("reject insecure project URL, wrong database URL and invalid sender address", () => {
  assert.equal(
    checkConfiguration("supabase", {
      NEXT_PUBLIC_SUPABASE_URL: "http://example.test",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-pub",
      SUPABASE_SERVICE_ROLE_KEY: "test-service",
    }).configured,
    false,
  );
  assert.equal(
    checkConfiguration("database", { DATABASE_URL: "https://example.test" }).configured,
    false,
  );
  assert.equal(
    checkConfiguration("email", {
      RESEND_API_KEY: "test-secret",
      RESEND_FROM_EMAIL: "bad",
      PROVIDER_TEST_EMAIL: "bad",
    }).configured,
    false,
  );
});
