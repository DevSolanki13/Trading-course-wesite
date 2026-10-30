import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { localDemoEnabled } from "../purchase/mode.ts";
import { seedLocal } from "./seed.ts";
const key = Symbol.for("market-method.local-postgres");
type Holder = typeof globalThis & { [key]?: Promise<PGlite> };
export function localDatabase(): Promise<PGlite> {
  if (!localDemoEnabled())
    throw new Error("Local sample database is disabled. Production uses Supabase.");
  const holder = globalThis as Holder;
  return (holder[key] ??= initialize().catch((error) => {
    delete holder[key];
    throw error;
  }));
}
async function initialize() {
  // Private, mutable runtime storage is never a statically traced build asset.
  const runtimePath = (...parts: string[]) => parts.join("/");
  const path = runtimePath(
    process.cwd(),
    ".local-data",
    process.env.LOCAL_DATA_NAME?.replace(/[^a-zA-Z0-9_-]/g, "") || "demo-v1",
  );
  await mkdir(path, { recursive: true });
  const db = new PGlite(path);
  await db.exec(`create schema if not exists local_auth;
    create table if not exists local_auth.migrations(name text primary key,checksum text not null);
    create table if not exists local_auth.credentials(id uuid primary key,email text not null unique,password_hash text not null);
    create table if not exists local_auth.sessions(token_hash text primary key,user_id uuid not null,expires_at timestamptz not null);
    create table if not exists local_auth.limits(key text primary key,attempts integer not null,expires_at timestamptz not null);`);
  const initialized = await db.query("select 1 from local_auth.migrations limit 1");
  if (!initialized.rows.length)
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}');
    create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
    create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  const root = join(process.cwd(), "backend/database/migrations");
  for (const name of (await readdir(root)).filter((file) => file.endsWith(".sql")).sort()) {
    const sql = await readFile(join(root, name), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const result = await db.query<{ checksum: string }>(
      "select checksum from local_auth.migrations where name=$1",
      [name],
    );
    if (result.rows.length) {
      if (result.rows[0].checksum !== checksum)
        throw new Error(
          `Local migration changed: ${name}. Use a new local data name for a disposable reset.`,
        );
      continue;
    }
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into local_auth.migrations values($1,$2)", [name, checksum]);
    });
  }
  await seedLocal(db);
  return db;
}
