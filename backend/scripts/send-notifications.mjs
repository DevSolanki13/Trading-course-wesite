import "./load-env.mjs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { verifyStagingTarget, safeDatabaseError } from "./database-target.mjs";
import { finishNotification } from "./notification-result.mjs";
import { sendNotification } from "../notifications/delivery.ts";
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
  accepted = 0,
  lostLease = 0;
try {
  await db.connect();
  const rows = (await db.query("select * from public.notification_claim()")).rows;
  for (const row of rows) {
    processed++;
    let success = false;
    try {
      const u = await admin.auth.admin.getUserById(row.user_id);
      if (!u.error && u.data.user?.email_confirmed_at && u.data.user.email) {
        success = await sendNotification(row, u.data.user.email);
      }
    } catch {}
    if (success) accepted++;
    if (!(await finishNotification(db, row, success))) lostLease++;
  }
  console.log(
    `Processed ${processed} queued messages; ${accepted} accepted by provider, ${processed - accepted} scheduled for retry. Addresses and provider responses withheld.`,
  );
  if (lostLease)
    console.error(
      `${lostLease} results had expired/replaced leases; no newer claim overwritten. Inspect the queue before retrying.`,
    );
  if (accepted !== processed || lostLease) process.exitCode = 1;
} catch (e) {
  console.error(`Notification worker failed: ${safeDatabaseError(e)}. Details withheld.`);
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
