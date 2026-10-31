import "./load-env.mjs";
import { readFileSync } from "node:fs";

/** Refuse a connection to a different Supabase project without printing credentials. */
export function verifyStagingTarget(env = process.env) {
  if (env.PROJECT_STAGE !== "staging") throw new Error("STAGING_REQUIRED");
  let database;
  let project;
  try {
    database = new URL(env.DATABASE_URL);
    project = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  } catch {
    throw new Error("INVALID_DATABASE_OR_PROJECT_URL");
  }
  const reference = project.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
  if (project.protocol !== "https:" || project.username || project.password)
    throw new Error("INVALID_SUPABASE_TARGET");
  if (!reference || !["postgres:", "postgresql:"].includes(database.protocol)) {
    throw new Error("INVALID_SUPABASE_TARGET");
  }
  const direct = database.hostname === `db.${reference}.supabase.co`;
  const pooled =
    database.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(database.username) === `postgres.${reference}`;
  if (!direct && !pooled) throw new Error("DATABASE_PROJECT_MISMATCH");
  if (pooled && database.port === "6543") throw new Error("SESSION_POOLER_REQUIRED_USE_PORT_5432");
  if (
    database.searchParams.get("uselibpqcompat") === "true" ||
    ["disable", "allow", "prefer", "no-verify"].includes(database.searchParams.get("sslmode"))
  )
    throw new Error("VERIFIED_DATABASE_TLS_REQUIRED");
  let ca;
  const caPath = env.DATABASE_CA_CERT_PATH || database.searchParams.get("sslrootcert");
  if (caPath) {
    try {
      ca = readFileSync(caPath, "utf8");
      if (!ca.includes("-----BEGIN CERTIFICATE-----")) throw new Error();
    } catch {
      throw new Error("INVALID_DATABASE_CA_CERTIFICATE");
    }
  }
  // Override URL SSL options and verify the hostname. A downloaded project CA
  // may be supplied explicitly, or via Node's NODE_EXTRA_CA_CERTS trust store.
  for (const key of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"])
    database.searchParams.delete(key);
  return {
    connectionString: database.toString(),
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    connectionTimeoutMillis: 15000,
  };
}

export function safeDatabaseError(error) {
  const code = error?.code ?? error?.message;
  return typeof code === "string" && /^[A-Z0-9_]{3,80}$/.test(code)
    ? code
    : "DATABASE_OPERATION_FAILED";
}
