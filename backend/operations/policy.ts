import { timingSafeEqual } from "node:crypto";
import type { Environment } from "../config/environment.ts";
export function operationsEnabled(env: Environment = process.env) {
  return (
    env.OPERATIONS_ENABLED === "true" &&
    env.PROJECT_STAGE === "staging" &&
    env.VERCEL_ENV !== "production"
  );
}
export function operationsAuthorized(header: string | null, env: Environment = process.env) {
  const secret = env.CRON_SECRET?.trim();
  if (
    !operationsEnabled(env) ||
    !secret ||
    secret.length < 32 ||
    /^(change|replace|example)/i.test(secret)
  )
    return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const incoming = Buffer.from(header ?? "");
  return expected.length === incoming.length && timingSafeEqual(expected, incoming);
}
