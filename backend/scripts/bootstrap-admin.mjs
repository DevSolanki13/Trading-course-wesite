import "./load-env.mjs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { verifyStagingTarget, safeDatabaseError } from "./database-target.mjs";
const index = process.argv.indexOf("--user-id");
const id = index >= 0 ? process.argv[index + 1] : "";
if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id) || !process.argv.includes("--apply")) {
  console.error("No changes made. Use --user-id <verified owner's UUID> --apply in staging.");
  process.exit(1);
}
const db = new pg.Client(verifyStagingTarget());
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
let connected = false;
try {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data.user?.email_confirmed_at) throw new Error("VERIFIED_ACCOUNT_REQUIRED");
  await db.connect();
  connected = true;
  await db.query("begin");
  const candidate = await db.query(
    "select role,blocked from public.profiles where id=$1 for update",
    [id],
  );
  if (
    candidate.rows.length !== 1 ||
    candidate.rows[0].role !== "student" ||
    candidate.rows[0].blocked
  )
    throw new Error("STUDENT_PROFILE_REQUIRED");
  await db.query("update public.profiles set role='admin' where id=$1 and role='student'", [id]);
  await db.query(
    "insert into public.audit_log(actor_id,action,target_type,target_id,details) values(null,'initial_admin_provisioned','account',$1,'{\"operator\":\"staging_cli\"}'::jsonb)",
    [id],
  );
  await db.query("commit");
  console.log(
    "Verified staging account promoted to Admin; operator audit recorded. Sign in and enroll MFA before using admin tools.",
  );
} catch (error) {
  if (connected) await db.query("rollback").catch(() => {});
  console.error(
    `Admin provisioning failed: ${safeDatabaseError(error)}. No account details shown.`,
  );
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
