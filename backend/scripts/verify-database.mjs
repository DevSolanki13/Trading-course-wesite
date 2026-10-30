import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import pg from "pg";
import { verifyStagingTarget, safeDatabaseError } from "./database-target.mjs";

let client;
try {
  client = new pg.Client(verifyStagingTarget());
  await client.connect();
  await client.query("begin read only");
  await client.query("set local statement_timeout = '15s'");
  const connection = await client.query(
    "select exists(select 1 from pg_namespace where nspname = 'auth') as auth_schema, exists(select 1 from pg_roles where rolname = 'service_role') as service_role",
  );
  if (!connection.rows[0].auth_schema || !connection.rows[0].service_role)
    throw new Error("SUPABASE_AUTH_SCHEMA_MISSING");
  console.log(
    "PASS staging project target matches configured Supabase URL; database connection and auth schema verified.",
  );
  if (!process.argv.includes("--connection-only")) {
    const migrations = readdirSync("backend/database/migrations")
      .filter((name) => name.endsWith(".sql"))
      .sort();
    for (const name of migrations) {
      const checksum = createHash("sha256")
        .update(readFileSync(`backend/database/migrations/${name}`, "utf8"))
        .digest("hex");
      const ledger = await client.query(
        "select checksum from course_migrations.applied where name = $1",
        [name],
      );
      if (ledger.rows[0]?.checksum !== checksum) {
        console.error(
          `Migration ledger: ${name}: ${ledger.rows.length ? "checksum differs" : "entry missing"}. No ledger or schema changes made.`,
        );
        throw new Error("MIGRATION_LEDGER_MISMATCH");
      }
    }
    const tables = [
      "profiles",
      "courses",
      "modules",
      "lessons",
      "lesson_assets",
      "orders",
      "payment_attempts",
      "webhook_events",
      "enrollments",
      "device_sessions",
      "audit_log",
      "site_settings",
      "auth_rate_limits",
      "auth_email_actions",
      "auth_recovery_grants",
      "lesson_progress",
      "learning_playbacks",
      "lesson_resources",
      "coupons",
      "coupon_redemptions",
      "site_content",
      "order_watch_ranges",
      "refund_requests",
      "refund_decisions",
      "notification_outbox",
      "operations_tasks",
      "billing_documents",
      "commerce_jobs",
    ];
    const schema = await client.query(
      "select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname = any($1::text[])",
      [tables],
    );
    if (schema.rows.length !== tables.length || schema.rows.some((row) => !row.relrowsecurity))
      throw new Error("TABLE_OR_RLS_CHECK_FAILED");
    const policies = await client.query(
      "select count(*)::int as count from pg_policies where schemaname='public' and tablename = any($1::text[])",
      [tables],
    );
    if (policies.rows[0].count < 7) throw new Error("POLICIES_MISSING");
    const grants = await client.query(
      "select has_table_privilege('anon','public.lesson_assets','SELECT') as public_assets, has_table_privilege('authenticated','public.enrollments','INSERT') as student_grants, has_table_privilege('authenticated','public.profiles','UPDATE') as student_promotion, has_table_privilege('authenticated','public.lesson_progress','INSERT,UPDATE,DELETE') as forged_progress, has_table_privilege('authenticated','public.refund_requests','INSERT,UPDATE,DELETE') as forged_refund, has_table_privilege('service_role','public.audit_log','UPDATE,DELETE') as audit_mutation, has_table_privilege('service_role','public.refund_decisions','UPDATE,DELETE') as mutable_decisions",
    );
    if (Object.values(grants.rows[0]).some(Boolean)) throw new Error("UNSAFE_TABLE_GRANT");
    const privateGrants = await client.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=any($1::text[]) and
      (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))`,
      [
        [
          "auth_rate_limits",
          "auth_email_actions",
          "auth_recovery_grants",
          "learning_playbacks",
          "lesson_resources",
          "coupons",
          "coupon_redemptions",
          "order_watch_ranges",
          "refund_decisions",
          "notification_outbox",
          "operations_tasks",
          "billing_documents",
          "commerce_jobs",
        ],
      ],
    );
    if (privateGrants.rows.length) throw new Error("UNSAFE_AUTH_TABLE_GRANT");
    const functions = await client.query(`select p.oid,p.proname,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as user_exec,
      has_function_privilege('service_role',p.oid,'EXECUTE') as service_exec
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname like 'auth\\_%' escape '\\'`);
    if (
      functions.rows.length !== 9 ||
      functions.rows.some((row) => row.anon_exec || row.user_exec || !row.service_exec)
    )
      throw new Error("UNSAFE_AUTH_FUNCTION_GRANT");
    const learningFunctions = await client.query(`select p.proname,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as user_exec,
      has_function_privilege('service_role',p.oid,'EXECUTE') as service_exec
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname like 'learning\\_%' escape '\\'`);
    if (
      learningFunctions.rows.length !== 5 ||
      learningFunctions.rows.some((row) => row.anon_exec || row.user_exec || !row.service_exec)
    )
      throw new Error("UNSAFE_LEARNING_FUNCTION_GRANT");
    const adminFunctions = await client.query(`select p.proname,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as user_exec,
      has_function_privilege('service_role',p.oid,'EXECUTE') as service_exec
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('admin_guard','refund_evidence','refund_statuses','refund_request','admin_mutate','admin_students','admin_overview','refund_settled','notification_claim')`);
    if (
      adminFunctions.rows.length !== 9 ||
      adminFunctions.rows.some((row) => row.anon_exec || row.user_exec || !row.service_exec)
    )
      throw new Error("UNSAFE_ADMIN_FUNCTION_GRANT");
    const paymentFunctions = await client.query(`select p.proname,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as user_exec,
      has_function_privilege('service_role',p.oid,'EXECUTE') as service_exec
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('demo_create_order','demo_settle_payment')`);
    if (
      paymentFunctions.rows.length !== 2 ||
      paymentFunctions.rows.some((row) => row.anon_exec || row.user_exec || !row.service_exec)
    )
      throw new Error("UNSAFE_PAYMENT_FUNCTION_GRANT");
    const commerceFunctions = await client.query(`select p.proname,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as user_exec,
      has_function_privilege('service_role',p.oid,'EXECUTE') as service_exec
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('commerce_document','commerce_create_order','commerce_settle_payment','commerce_close_order','commerce_refund_state','commerce_claim_jobs','commerce_finish_job','commerce_ops_summary')`);
    if (
      commerceFunctions.rows.length !== 8 ||
      commerceFunctions.rows.some((row) => row.anon_exec || row.user_exec || !row.service_exec)
    )
      throw new Error("UNSAFE_COMMERCE_FUNCTION_GRANT");
    const triggers = await client.query(
      "select count(*)::int as count from pg_trigger where not tgisinternal and tgname in ('on_auth_user_created','orders_protect_snapshots','group_removal_recheck')",
    );
    if (triggers.rows[0].count !== 3) throw new Error("TRIGGERS_MISSING");
    const settings = await client.query(
      "select device_limit, refund_window_days, refund_watch_limit_percent from public.site_settings where id=true",
    );
    if (!settings.rows.length) throw new Error("DEFAULT_SETTINGS_MISSING");
    const cap = await client.query(
      "select convalidated from pg_constraint where conname='site_settings_device_limit_max_two' and conrelid='public.site_settings'::regclass",
    );
    if (
      cap.rows.length !== 1 ||
      cap.rows[0].convalidated !== true ||
      settings.rows[0].device_limit > 2
    )
      throw new Error("DEVICE_CAP_NOT_ENFORCED");
    console.log(
      `PASS ${migrations.length} migration checksums, ${tables.length} RLS-protected tables, ownership/admitted-session policies, restricted tables, nine auth/five learning/nine admin RPC grants, three triggers and default settings.`,
    );
  }
  await client.query("rollback");
  console.log("Verification complete; read-only queries made no data changes.");
} catch (error) {
  console.error(
    `Database verification failed: ${safeDatabaseError(error)} (credentials withheld).`,
  );
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}
