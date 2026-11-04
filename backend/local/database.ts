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
  // Clean up any stale postmaster.pid left over from an abrupt exit or reload
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(join(path, "postmaster.pid"));
  } catch {
    /* file does not exist, ignore */
  }
  const db = new PGlite(path);
  await db.exec(`create schema if not exists local_auth;
    create table if not exists local_auth.migrations(name text primary key,checksum text not null);
    create table if not exists local_auth.credentials(id uuid primary key,email text not null unique,password_hash text not null);
    create table if not exists local_auth.sessions(token_hash text primary key,user_id uuid not null,expires_at timestamptz not null);
    create table if not exists local_auth.limits(key text primary key,attempts integer not null,expires_at timestamptz not null);`);
  // Roles: try CREATE ROLE first; if it already exists PGlite throws – catch and ignore.
  try {
    await db.exec(`create role anon`);
  } catch {
    /* exists */
  }
  try {
    await db.exec(`create role authenticated`);
  } catch {
    /* exists */
  }
  try {
    await db.exec(`create role service_role bypassrls`);
  } catch {
    /* exists */
  }
  // Auth schema setup – each statement is isolated so one failure cannot abort the rest.
  try {
    await db.exec(`create schema if not exists auth`);
  } catch {
    /* exists */
  }
  try {
    await db.exec(
      `create table if not exists auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}')`,
    );
  } catch {
    /* exists */
  }
  try {
    await db.exec(
      `create table if not exists auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz)`,
    );
  } catch {
    /* exists */
  }
  try {
    await db.exec(
      `create or replace function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$`,
    );
  } catch {
    /* ignore */
  }
  try {
    await db.exec(
      `create or replace function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$`,
    );
  } catch {
    /* ignore */
  }
  // Grant schema usage individually – multi-schema grants can abort PGlite WASM.
  for (const schema of ["public", "auth"]) {
    for (const role of ["anon", "authenticated", "service_role"]) {
      try {
        await db.exec(`grant usage on schema ${schema} to ${role}`);
      } catch {
        /* ignore */
      }
    }
  }
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
