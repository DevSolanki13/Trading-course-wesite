import "./load-env.mjs";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import pg from "pg";
import { verifyStagingTarget, safeDatabaseError } from "./database-target.mjs";

// Read-only on the verified staging project. Output includes counts and migration
// names only, never row contents, user identifiers, credentials or provider bodies.
const checks = [];
const report = (id, passed, details) =>
  checks.push({ id, status: passed ? "pass" : "blocked", details });
let client;
try {
  client = new pg.Client(verifyStagingTarget());
  await client.connect();
  await client.query("begin isolation level repeatable read read only");
  await client.query("set local statement_timeout='15s'");
  for (const name of readdirSync("backend/database/migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    const expected = createHash("sha256")
      .update(readFileSync(`backend/database/migrations/${name}`, "utf8"))
      .digest("hex");
    const result = await client.query(
      "select checksum from course_migrations.applied where name=$1",
      [name],
    );
    report(
      `migration:${name}`,
      result.rows[0]?.checksum === expected,
      !result.rows.length
        ? "ledger entry missing; inspect schema before any migration"
        : result.rows[0].checksum !== expected
          ? "checksum differs; investigate drift without editing applied files"
          : "checksum matches",
    );
  }
  const integrity = (
    await client.query(`select
    (select count(*)::int from public.enrollments e left join public.orders o on o.id=e.order_id
      where e.source='purchase' and e.active and e.revoked_at is null
      and (o.id is null or o.status<>'paid' or o.user_id<>e.user_id or o.course_id<>e.course_id)) as invalid_purchase_access,
    (select count(*)::int from public.orders o where o.status='paid' and not exists
      (select 1 from public.enrollments e where e.order_id=o.id and e.user_id=o.user_id and e.course_id=o.course_id and e.source='purchase')) as paid_without_enrollment,
    (select count(*)::int from public.orders where total_paise<>base_paise-discount_paise+tax_paise) as invalid_totals,
    (select count(*)::int from public.notification_outbox where state<>'sent' and attempts>=8) as exhausted_notifications,
    (select count(*)::int from public.notification_outbox where state='sending' and claimed_until<now()) as expired_notification_leases,
    (select count(*)::int from public.webhook_events where status='failed' or (status='received' and received_at<now()-interval '15 minutes')) as unprocessed_webhooks,
    (select count(*)::int from public.refund_requests where state in ('approved','processing') and updated_at<now()-interval '24 hours') as stalled_refunds,
    (select count(*)::int from public.courses where status='published' and (slug like '%verify%' or slug like '%test%' or slug like '%fixture%')) as published_test_courses
  `)
  ).rows[0];
  for (const [id, count] of Object.entries(integrity)) report(id, count === 0, { count });
  const queues = (
    await client.query(`select
    (select count(*)::int from public.notification_outbox where state in ('pending','failed') and attempts<8) as retryable_notifications,
    (select count(*)::int from public.orders where status='pending' and created_at<now()-interval '30 minutes') as old_pending_orders,
    (select count(*)::int from public.operations_tasks where state='open') as manual_operations
  `)
  ).rows[0];
  checks.push({ id: "queues", status: "info", details: queues });
  await client.query("rollback");
} catch (error) {
  report("database", false, safeDatabaseError(error));
} finally {
  await client?.query("rollback").catch(() => {});
  await client?.end().catch(() => {});
}
const result = {
  checkedAt: new Date().toISOString(),
  stage: "staging",
  readOnly: true,
  readyForSales: false,
  checks,
};
mkdirSync("artifacts/phase-6", { recursive: true });
writeFileSync("artifacts/phase-6/operations.json", JSON.stringify(result, null, 2) + "\n");
for (const check of checks)
  console.log(
    `${check.status.toUpperCase()} ${check.id}: ${typeof check.details === "string" ? check.details : JSON.stringify(check.details)}`,
  );
console.log(
  "No data changed. See artifacts/phase-6/operations.json. This report does not approve live sales.",
);
if (checks.some((check) => check.status === "blocked")) process.exitCode = 1;
