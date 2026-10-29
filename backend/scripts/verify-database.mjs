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
      if (ledger.rows[0]?.checksum !== checksum) throw new Error("MIGRATION_LEDGER_MISMATCH");
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
      "select has_table_privilege('anon','public.lesson_assets','SELECT') as public_assets, has_table_privilege('authenticated','public.enrollments','INSERT') as student_grants, has_table_privilege('authenticated','public.profiles','UPDATE') as student_promotion, has_table_privilege('service_role','public.audit_log','UPDATE,DELETE') as audit_mutation",
    );
    if (Object.values(grants.rows[0]).some(Boolean)) throw new Error("UNSAFE_TABLE_GRANT");
    const privateGrants = await client.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=any($1::text[]) and
      (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))`,
      [["auth_rate_limits", "auth_email_actions", "auth_recovery_grants"]],
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
    const triggers = await client.query(
      "select count(*)::int as count from pg_trigger where not tgisinternal and tgname in ('on_auth_user_created','orders_protect_snapshots')",
    );
    if (triggers.rows[0].count !== 2) throw new Error("TRIGGERS_MISSING");
    const settings = await client.query(
      "select device_limit, refund_window_days, refund_watch_limit_percent from public.site_settings where id=true",
    );
    if (!settings.rows.length) throw new Error("DEFAULT_SETTINGS_MISSING");
    console.log(
      `PASS ${migrations.length} migration checksums, ${tables.length} RLS-protected tables, ownership/admitted-session policies, restricted table and nine auth-function grants, both triggers and default settings.`,
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
