import type { Environment } from "../config/environment.ts";
export type Notification = {
  id: string;
  dedupe_key: string;
  subject: string;
  body: string;
  attempts: number;
  claimed_until: string;
  delivery_started_at: string;
};
export async function sendNotification(
  row: Notification,
  email: string,
  env: Environment = process.env,
  fetcher: typeof fetch = fetch,
) {
  if (
    !Number.isFinite(Date.parse(row.delivery_started_at)) ||
    Date.now() - Date.parse(row.delivery_started_at) > 23 * 3600000
  )
    return false;
  if (Date.parse(row.claimed_until) <= Date.now() || !env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL)
    return false;
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": row.dedupe_key,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [email],
      subject: row.subject,
      text: row.body,
    }),
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  return response.ok;
}
