import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { verifyStagingTarget, safeDatabaseError } from "../backend/scripts/database-target.mjs";
import { finishNotification } from "../backend/scripts/notification-result.mjs";

const env = {
  PROJECT_STAGE: "staging",
  NEXT_PUBLIC_SUPABASE_URL: "https://fixtureproject.supabase.co",
  DATABASE_URL:
    "postgresql://postgres.fixtureproject:unused@aws-0-fixture.pooler.supabase.com:5432/postgres?sslmode=require",
};
test("operator database connections require matching staging project and verified TLS", () => {
  const target = verifyStagingTarget(env);
  assert.equal(target.ssl.rejectUnauthorized, true);
  assert.equal(new URL(target.connectionString).searchParams.has("sslmode"), false);
  for (const override of [
    { PROJECT_STAGE: "production" },
    { NEXT_PUBLIC_SUPABASE_URL: "http://fixtureproject.supabase.co" },
    { DATABASE_URL: env.DATABASE_URL.replace("fixtureproject:", "otherproject:") },
    { DATABASE_URL: env.DATABASE_URL.replace(":5432", ":6543") },
    { DATABASE_URL: env.DATABASE_URL.replace("sslmode=require", "sslmode=no-verify") },
    { DATABASE_URL: env.DATABASE_URL.replace("sslmode=require", "uselibpqcompat=true") },
    { DATABASE_URL: env.DATABASE_URL.replace("sslmode=require", "sslmode=disable") },
    { DATABASE_URL: "postgresql://postgres:unused@attacker.invalid/postgres" },
    { DATABASE_CA_CERT_PATH: "artifacts/no-such-database-ca.pem" },
  ])
    assert.throws(() => verifyStagingTarget({ ...env, ...override }));
  assert.equal(
    safeDatabaseError(new Error("private connection details")),
    "DATABASE_OPERATION_FAILED",
  );
});

test("notification completion rejects old/expired workers and schedules a durable retry", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table notification_outbox(id uuid primary key, state text, attempts int, claimed_until timestamptz, next_attempt_at timestamptz);
      insert into notification_outbox values('11111111-1111-4111-8111-111111111111','sending',2,now()+interval '5 minutes',now());`);
    const row = { id: "11111111-1111-4111-8111-111111111111", attempts: 1 };
    assert.equal(await finishNotification(db, row, true), false);
    assert.equal(await finishNotification(db, row, false), false);
    assert.equal(
      (await db.query("select state from notification_outbox")).rows[0].state,
      "sending",
    );
    row.attempts = 2;
    assert.equal(await finishNotification(db, row, false), true);
    const failed = (
      await db.query(
        "select state,claimed_until,next_attempt_at>now()+interval '19 minutes' as backed_off from notification_outbox",
      )
    ).rows[0];
    assert.equal(failed.state, "failed");
    assert.equal(failed.claimed_until, null);
    assert.equal(failed.backed_off, true);
    await db.exec(
      "update notification_outbox set state='sending',attempts=3,claimed_until=now()-interval '1 second'",
    );
    row.attempts = 3;
    assert.equal(await finishNotification(db, row, true), false);
    await db.exec("update notification_outbox set claimed_until=now()+interval '5 minutes'");
    assert.equal(await finishNotification(db, row, true), true);
    assert.equal(await finishNotification(db, row, false), false);
    assert.equal((await db.query("select state from notification_outbox")).rows[0].state, "sent");
  } finally {
    await db.close();
  }
});
