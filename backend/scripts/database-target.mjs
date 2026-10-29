import "./load-env.mjs";

/** Refuse a connection to a different Supabase project without printing credentials. */
export function verifyStagingTarget() {
  if (process.env.PROJECT_STAGE !== "staging") throw new Error("STAGING_REQUIRED");
  let database;
  let project;
  try {
    database = new URL(process.env.DATABASE_URL);
    project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  } catch {
    throw new Error("INVALID_DATABASE_OR_PROJECT_URL");
  }
  const reference = project.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
  if (!reference || !["postgres:", "postgresql:"].includes(database.protocol)) {
    throw new Error("INVALID_SUPABASE_TARGET");
  }
  const direct = database.hostname === `db.${reference}.supabase.co`;
  const pooled =
    database.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(database.username) === `postgres.${reference}`;
  if (!direct && !pooled) throw new Error("DATABASE_PROJECT_MISMATCH");
  if (pooled && database.port === "6543") throw new Error("SESSION_POOLER_REQUIRED_USE_PORT_5432");
  return { connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 };
}

export function safeDatabaseError(error) {
  const code = error?.code ?? error?.message;
  return typeof code === "string" && /^[A-Z0-9_]{3,80}$/.test(code)
    ? code
    : "DATABASE_OPERATION_FAILED";
}
