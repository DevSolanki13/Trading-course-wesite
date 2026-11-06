import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "../database/supabase";
import { requireEnv } from "../config/env";
import { appOrigin, AuthError } from "./http";
import { tokenDigest, sealToken } from "./crypto";
import { safeNext } from "./policy";
import nodemailer from "nodemailer";
import { buildAuthEmailHtml, buildAuthEmailText } from "./email-template";
import { emailLogoAttachment } from "../email/logo";

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
  const subject = `indianXtrade | ${title}`;
  const text = buildAuthEmailText({ url: url.toString(), purpose: input.purpose });
  const html = buildAuthEmailHtml({
    url: url.toString(),
    purpose: input.purpose,
  });

  try {
    const logo = await emailLogoAttachment();
    if (process.env.RESEND_API_KEY) {
      // --- Resend path ---
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
          subject,
          text,
          html,
          attachments: [logo],
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("DELIVERY_FAILED");
    } else {
      // --- Gmail SMTP path (no Resend needed) ---
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: requireEnv("GMAIL_USER").trim(),
          pass: requireEnv("GMAIL_APP_PASSWORD").replace(/\s+/g, ""),
        },
      });
      await transporter.sendMail({
        from: `"indianXtrade" <${requireEnv("GMAIL_USER")}>`,
        to: input.email,
        subject,
        text,
        html,
        attachments: [
          {
            filename: logo.filename,
            content: Buffer.from(logo.content, "base64"),
            contentType: logo.content_type,
            contentDisposition: "inline",
            cid: logo.content_id,
          },
        ],
      });
    }
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
