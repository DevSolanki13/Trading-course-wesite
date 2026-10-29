import "./load-env.mjs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import pg from "pg";
import { checkConfiguration } from "../config/environment.ts";
import { verifyStagingTarget, safeDatabaseError } from "./database-target.mjs";

const configuration = checkConfiguration("database", process.env);
if (
  !configuration.configured ||
  !existsSync(".vercel/project.json") ||
  process.env.PROJECT_STAGE !== "staging"
) {
  console.error(
    "Migration blocked: configure DATABASE_URL, link the Vercel staging project, and set PROJECT_STAGE=staging.",
  );
  process.exit(1);
}
if (!process.argv.includes("--apply")) {
  console.error(
    "No changes made. Review the SQL and target; then run npm run db:migrate -- --apply.",
  );
  process.exit(1);
}

let target;
try {
  target = verifyStagingTarget();
} catch (error) {
  console.error(`Migration target refused: ${safeDatabaseError(error)} (credentials withheld).`);
  process.exit(1);
}
const client = new pg.Client(target);
let connected = false;
try {
  await client.connect();
  connected = true;
  await client.query("begin");
  await client.query("select pg_advisory_xact_lock(631092118)");
  await client.query("create schema if not exists course_migrations");
  await client.query("revoke all on schema course_migrations from public, anon, authenticated");
  await client.query(
    "create table if not exists course_migrations.applied (name text primary key, checksum text not null, applied_at timestamptz not null default now())",
  );
  const files = readdirSync("backend/database/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) {
    const sql = readFileSync(`backend/database/migrations/${name}`, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const previous = await client.query(
      "select checksum from course_migrations.applied where name = $1",
      [name],
    );
    if (previous.rows.length) {
      if (previous.rows[0].checksum !== checksum) throw new Error("Applied migration changed");
      console.log(`Already applied: ${name}`);
      continue;
    }
    await client.query(sql);
    await client.query("insert into course_migrations.applied(name, checksum) values ($1, $2)", [
      name,
      checksum,
    ]);
    console.log(`Prepared: ${name}`);
  }
  await client.query("commit");
  console.log("Migration transaction committed.");
} catch (error) {
  if (connected) await client.query("rollback").catch(() => {});
  console.error(
    `Migration failed: ${safeDatabaseError(error)}. ${connected ? "Transaction rolled back." : "No connection established; no changes made."} Credentials withheld.`,
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
