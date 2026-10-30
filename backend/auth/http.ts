import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "../database/supabase";
import { requireEnv } from "../config/env";

export class AuthError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = "AUTH_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function appOrigin() {
  const url = new URL(requireEnv("NEXT_PUBLIC_APP_URL"));
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname))
    throw new AuthError(503, "Secure application URL is not configured.");
  return url.origin;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(appOrigin());
  if (origin === expected.origin) return;
  try {
    const incoming = new URL(origin ?? "");
    if (
      ["localhost", "127.0.0.1"].includes(expected.hostname) &&
      ["localhost", "127.0.0.1"].includes(incoming.hostname) &&
      incoming.protocol === expected.protocol &&
      incoming.port === expected.port
    )
      return;
  } catch {}
  throw new AuthError(403, "This request must come from the application.", "ORIGIN_REQUIRED");
}
export async function body(request: Request, maximumBytes = 16384) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AuthError(415, "Send a JSON request.");
  const reader = request.body?.getReader();
  if (!reader) throw new AuthError(400, "Invalid request.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) {
      await reader.cancel();
      throw new AuthError(413, "Request is too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AuthError(400, "Invalid request.");
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
export function failure(error: unknown) {
  if (error instanceof AuthError)
    return json({ error: error.message, code: error.code }, error.status);
  console.error("Authentication operation failed; sensitive details withheld.");
  return json(
    {
      error: "This action is temporarily unavailable. Please try again.",
      code: "SERVICE_UNAVAILABLE",
    },
    503,
  );
}
export async function limit(
  request: Request,
  action: string,
  subject = "",
  maximum = 10,
  seconds = 900,
) {
  const address = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : "local";
  const key = createHmac("sha256", requireEnv("SUPABASE_SERVICE_ROLE_KEY"))
    .update(`${action}:${subject ? "account" : address}:${subject.toLowerCase()}`)
    .digest("hex");
  const { data, error } = await createAdminClient().rpc("auth_consume_limit", {
    p_key: key,
    p_limit: maximum,
    p_seconds: seconds,
  });
  if (error) throw new AuthError(503, "Sign-in protection is temporarily unavailable.");
  if (data !== true)
    throw new AuthError(429, "Too many attempts. Please wait and try again.", "RATE_LIMITED");
}
