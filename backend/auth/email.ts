import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "../database/supabase";
import { requireEnv } from "../config/env";
import { appOrigin, AuthError } from "./http";
import { tokenDigest, sealToken } from "./crypto";
import { safeNext } from "./policy";

export async function deliverAuthEmail(input: {
  userId: string;
  email: string;
  providerHash: string;
  purpose: "signup" | "recovery" | "invite";
  next?: string;
}) {
  const admin = createAdminClient();
  const nonce = randomBytes(32).toString("base64url");
  const hash = tokenDigest(nonce);
  const { error } = await admin.from("auth_email_actions").insert({
    nonce_hash: hash,
    user_id: input.userId,
    token_ciphertext: sealToken(input.providerHash, requireEnv("SUPABASE_SERVICE_ROLE_KEY")),
    purpose: input.purpose,
    next_path: safeNext(input.next),
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  if (error) throw new AuthError(503, "The email link could not be prepared. Please try again.");
  const title =
    input.purpose === "recovery"
      ? "Reset your password"
      : input.purpose === "invite"
        ? "Your support team invitation"
        : "Verify your email";
  const url = new URL("/auth/confirm", appOrigin());
  url.searchParams.set("token", nonce);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `auth-${hash}`,
      },
      body: JSON.stringify({
        from: requireEnv("RESEND_FROM_EMAIL"),
        to: [input.email],
        subject: `${title} | Market Method`,
        text: `${title}\n\nOpen the link below, then press Continue to confirm the action. This link expires in 30 minutes and works once.\n\n${url.toString()}\n\nIf you did not request this email, ignore it. Never share this link.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:40px auto;color:#203025"><p>marketmethod.</p><h1 style="font-size:28px">${title}</h1><p>Open this link, then press Continue to confirm. It expires in 30 minutes and works once.</p><p style="margin:30px 0"><a style="background:#345e37;color:#fff;padding:14px 22px;border-radius:8px;text-decoration:none" href="${url.toString()}">Continue securely</a></p><p>If you did not request this email, you can ignore it. Never share this link.</p></div>`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("DELIVERY_FAILED");
    await admin
      .from("auth_email_actions")
      .update({ delivery_state: "sent" })
      .eq("nonce_hash", hash);
  } catch {
    await admin
      .from("auth_email_actions")
      .update({ delivery_state: "failed" })
      .eq("nonce_hash", hash);
    console.error("Auth email delivery failed; recipient and provider details withheld.");
    throw new AuthError(
      503,
      "Email delivery is temporarily unavailable. Please try again later.",
      "EMAIL_UNAVAILABLE",
    );
  }
}
