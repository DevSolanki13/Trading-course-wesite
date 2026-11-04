import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "../database/supabase";
import { requireEnv } from "../config/env";
import { appOrigin, AuthError } from "./http";
import { tokenDigest, sealToken } from "./crypto";
import { safeNext } from "./policy";
import nodemailer from "nodemailer";

function buildAuthEmailHtml(input: {
  title: string;
  url: string;
  purpose: "signup" | "recovery" | "invite";
  origin: string;
}): string {
  const { title, url, purpose, origin } = input;

  const badgeText =
    purpose === "recovery"
      ? "Password Reset"
      : purpose === "invite"
        ? "Staff Workspace Invitation"
        : "Account Verification";

  const badgeBg = purpose === "recovery" ? "#fffbeb" : purpose === "invite" ? "#eff6ff" : "#ecfdf5";
  const badgeBorder =
    purpose === "recovery" ? "#fde68a" : purpose === "invite" ? "#bfdbfe" : "#a7f3d0";
  const badgeColor =
    purpose === "recovery" ? "#92400e" : purpose === "invite" ? "#1e40af" : "#065f46";

  const headline =
    purpose === "recovery"
      ? "Reset your password"
      : purpose === "invite"
        ? "Team workspace access"
        : "Verify your email address";

  const introText =
    purpose === "recovery"
      ? "We received a request to reset the password associated with your account. Click the button below to securely set a new password."
      : purpose === "invite"
        ? "You have been invited to join the <strong>indianXtrade</strong> staff and management workspace. Click below to accept the invitation and configure your access."
        : "Welcome to <strong>indianXtrade</strong>! Please confirm your email address to activate your student account and access your learning dashboard and course materials.";

  const buttonText =
    purpose === "recovery"
      ? "Reset password securely"
      : purpose === "invite"
        ? "Accept invitation &amp; continue"
        : "Verify email &amp; continue";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f1f5f9;padding:36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;background-color:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(15,23,42,0.05);">
          <!-- Indian Flag Tri-Color Top Stripe -->
          <tr>
            <td style="padding:0;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="height:5px;line-height:5px;font-size:1px;">
                <tr>
                  <td width="33.3%" style="background-color:#FF9933;">&nbsp;</td>
                  <td width="33.4%" style="background-color:#FFFFFF;">&nbsp;</td>
                  <td width="33.3%" style="background-color:#138808;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Header Section -->
          <tr>
            <td align="center" style="padding:32px 36px 20px 36px;">
              <a href="${origin}" target="_blank" style="text-decoration:none;display:inline-block;">
                <img src="${origin}/brand/indianxtrade-light.png" alt="indianXtrade" width="190" height="50" style="display:block;max-width:190px;height:auto;border:0;margin:0 auto;outline:none;" />
              </a>
              <div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:1.5px;text-transform:uppercase;margin-top:8px;">
                India me trading chat
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="border-top:1px solid #edf2f7;height:1px;line-height:1px;">&nbsp;</div>
            </td>
          </tr>

          <!-- Content Section -->
          <tr>
            <td style="padding:28px 36px 36px 36px;">
              <div style="display:inline-block;padding:5px 12px;background-color:${badgeBg};border:1px solid ${badgeBorder};border-radius:9999px;font-size:11px;font-weight:700;color:${badgeColor};letter-spacing:0.5px;text-transform:uppercase;margin-bottom:16px;">
                ${badgeText}
              </div>

              <h1 style="margin:0 0 16px 0;font-size:23px;font-weight:700;color:#0f172a;line-height:1.3;">
                ${headline}
              </h1>

              <p style="margin:0 0 24px 0;font-size:15px;color:#334155;line-height:1.6;">
                ${introText}
              </p>

              <!-- Primary Action Button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td align="center" style="border-radius:9px;background-color:#059669;box-shadow:0 2px 6px rgba(5,150,105,0.3);">
                    <a href="${url}" target="_blank" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:9px;border:1px solid #059669;">
                      ${buttonText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry & Security Notice Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #059669;border-radius:8px;margin:24px 0;">
                <tr>
                  <td style="padding:16px;">
                    <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:6px;">
                      Security &amp; Expiration Notice
                    </div>
                    <div style="font-size:13px;color:#475569;line-height:1.5;">
                      &bull; <strong>30-Minute Window:</strong> This single-use link expires in 30 minutes.<br />
                      &bull; <strong>Strict Confidentiality:</strong> Never forward or share this email. Staff will never ask for your authentication link or password.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Fallback Plain URL Box -->
              <p style="margin:24px 0 8px 0;font-size:13px;color:#64748b;line-height:1.5;">
                Having trouble with the button above? Copy and paste the link below directly into your web browser:
              </p>
              <div style="background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:12px;font-family:SFMono-Regular,Consolas,Monaco,'Liberation Mono',Menlo,monospace;font-size:12px;color:#334155;word-break:break-all;line-height:1.4;">
                <a href="${url}" target="_blank" style="color:#0284c7;text-decoration:underline;">${url}</a>
              </div>

              <p style="margin:24px 0 0 0;font-size:13px;color:#64748b;line-height:1.5;">
                If you did not create an account or request this verification, please safely ignore this message. No action will be taken on your account.
              </p>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #edf2f7;padding:24px 36px;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#334155;">
                indianXtrade
              </p>
              <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;line-height:1.5;">
                Learn the process. Respect the risk.<br />
                Operated by Nikhil Pandey &middot; Bhopal, Madhya Pradesh 462011, India
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Need assistance? Contact our team at <a href="mailto:support@indianxtrade.com" style="color:#059669;text-decoration:none;">support@indianxtrade.com</a>
              </p>
              <p style="margin:12px 0 0 0;font-size:11px;color:#cbd5e1;">
                &copy; 2026 indianXtrade. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildAuthEmailText(input: {
  title: string;
  url: string;
  purpose: "signup" | "recovery" | "invite";
}): string {
  const { title, url, purpose } = input;
  const introText =
    purpose === "recovery"
      ? "We received a request to reset the password associated with your account. Open the link below to set a new password."
      : purpose === "invite"
        ? "You have been invited to join the indianXtrade staff and management workspace. Open the link below to accept the invitation."
        : "Welcome to indianXtrade! Please confirm your email address to activate your student account.";

  return `indianXtrade | ${title}
==================================================

${introText}

Confirm your email by clicking the link below:
${url}

Security & Expiration Notice:
- This single-use link expires in 30 minutes.
- Never share this link with anyone. indianXtrade staff will never ask for your passwords or authentication links.
- If you did not make this request, you can safely ignore this email.

==================================================
indianXtrade · Learn the process. Respect the risk.
Operated by Nikhil Pandey · Bhopal, Madhya Pradesh 462011, India
Support: support@indianxtrade.com
© 2026 indianXtrade. All rights reserved.`;
}

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
  const text = buildAuthEmailText({ title, url: url.toString(), purpose: input.purpose });
  const html = buildAuthEmailHtml({
    title: subject,
    url: url.toString(),
    purpose: input.purpose,
    origin: appOrigin(),
  });

  try {
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
