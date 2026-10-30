import "./load-env.mjs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { verifyStagingTarget, safeDatabaseError } from "./database-target.mjs";
if (!process.argv.includes("--send")) {
  console.log(
    "No emails sent. Use --send after checking pending refund notifications and the configured sender.",
  );
  process.exit(0);
}
if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
  console.error("No messages claimed: configure RESEND_API_KEY and RESEND_FROM_EMAIL.");
  process.exit(1);
}
const db = new pg.Client(verifyStagingTarget());
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
let processed = 0,
  accepted = 0;
try {
  await db.connect();
  const rows = (await db.query("select * from public.notification_claim()")).rows;
  for (const row of rows) {
    processed++;
    let success = false;
    try {
      const u = await admin.auth.admin.getUserById(row.user_id);
      if (!u.error && u.data.user?.email_confirmed_at && u.data.user.email) {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": row.dedupe_key,
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL,
            to: [u.data.user.email],
            subject: row.subject,
            text: row.body,
          }),
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });
        success = r.ok;
      }
    } catch {}
    if (success) {
      accepted++;
      await db.query(
        "update notification_outbox set state='sent',claimed_until=null where id=$1 and state='sending'",
        [row.id],
      );
    } else {
      const backoff = Math.min(86400, 300 * 2 ** Math.min(row.attempts, 8));
      await db.query(
        "update notification_outbox set state='failed',claimed_until=null,next_attempt_at=now()+make_interval(secs=>$2)where id=$1 and state='sending'",
        [row.id, backoff],
      );
    }
  }
  console.log(
    `Processed ${processed} queued messages; ${accepted} accepted by provider, ${processed - accepted} scheduled for retry. Addresses and provider responses withheld.`,
  );
  if (accepted !== processed) process.exitCode = 1;
} catch (e) {
  console.error(`Notification worker failed: ${safeDatabaseError(e)}. Details withheld.`);
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
