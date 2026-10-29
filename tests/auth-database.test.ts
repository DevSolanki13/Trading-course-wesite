import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("auth migration denies pending/revoked sessions, enforces device caps and protects security tables", async () => {
  const db = new PGlite();
  const user = "11111111-1111-4111-8111-111111111111";
  const sessions = [
    "22222222-2222-4222-8222-222222222221",
    "22222222-2222-4222-8222-222222222222",
    "22222222-2222-4222-8222-222222222223",
  ];
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
      create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb not null default '{}');
      create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
    for (const file of [
      "202610290001_initial_foundation.sql",
      "202610290002_auth_sessions.sql",
      "202610290003_auth_hardening.sql",
    ])
      await db.exec(
        await readFile(new URL(`../backend/database/migrations/${file}`, import.meta.url), "utf8"),
      );
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,'auth-test@example.invalid','{\"role\":\"admin\"}')",
      [user],
    );
    for (const session of sessions)
      await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [session, user]);
    assert.equal(
      (await db.query<{ role: string }>("select role from profiles")).rows[0].role,
      "student",
    );
    await db.exec("set role service_role");
    assert.equal(
      (
        await db.query<{ state: string }>(
          "select public.auth_admit_device($1,$2,'First',false,null) as state",
          [user, sessions[0]],
        )
      ).rows[0].state,
      "admitted",
    );
    assert.equal(
      (
        await db.query<{ state: string }>(
          "select public.auth_admit_device($1,$2,'Second',false,null) as state",
          [user, sessions[1]],
        )
      ).rows[0].state,
      "admitted",
    );
    assert.equal(
      (
        await db.query<{ state: string }>(
          "select public.auth_admit_device($1,$2,'Third',false,null) as state",
          [user, sessions[2]],
        )
      ).rows[0].state,
      "limit",
    );
    await db.exec("reset role;set role authenticated");
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
      [user, JSON.stringify({ session_id: sessions[2] })],
    );
    assert.equal(
      (await db.query("select * from profiles")).rows.length,
      0,
      "pending third device must not read private profile directly",
    );
    await assert.rejects(
      db.query("select public.auth_admit_device($1,$2,'Attack',true,null)", [user, sessions[2]]),
      /permission denied/,
    );
    await assert.rejects(db.exec("select * from auth_email_actions"), /permission denied/);
    await assert.rejects(db.exec("update profiles set role='admin'"), /permission denied/);
    await db.exec("reset role;set role service_role");
    const first = (
      await db.query<{ id: string }>("select id from device_sessions where auth_session_id=$1", [
        sessions[0],
      ])
    ).rows[0].id;
    assert.equal(
      (
        await db.query<{ state: string }>(
          "select public.auth_admit_device($1,$2,'Third',false,$3) as state",
          [user, sessions[2], first],
        )
      ).rows[0].state,
      "admitted",
    );
    assert.equal(
      (
        await db.query<{ active: boolean }>("select public.auth_has_session($1,$2) as active", [
          user,
          sessions[0],
        ])
      ).rows[0].active,
      false,
    );
    assert.equal(
      (
        await db.query<{ state: string }>(
          "select public.auth_admit_device($1,$2,'Replay',false,null) as state",
          [user, sessions[0]],
        )
      ).rows[0].state,
      "revoked",
    );
    for (let index = 0; index < 3; index++)
      assert.equal(
        (
          await db.query<{ allowed: boolean }>(
            "select public.auth_consume_limit('test',2,60) as allowed",
          )
        ).rows[0].allowed,
        index < 2,
      );
    await db.query("select public.auth_revoke_devices($1,$2,null,true)", [user, sessions[2]]);
    assert.equal(
      (
        await db.query<{ active: boolean }>("select public.auth_has_session($1,$2) as active", [
          user,
          sessions[2],
        ])
      ).rows[0].active,
      false,
    );
    assert.equal((await db.query("select * from audit_log")).rows.length >= 2, true);
  } finally {
    await db.close();
  }
});
