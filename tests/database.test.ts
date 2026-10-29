import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("baseline migration enforces RLS, immutable paid totals, private assets and webhook uniqueness", async () => {
  const db = new PGlite();
  try {
    // Minimal Supabase auth contract in an isolated, disposable PostgreSQL engine.
    // This does not provision Supabase or verify its remote auth service.
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
      create schema auth;
      create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
    `);
    await db.exec(
      await readFile(
        new URL(
          "../backend/database/migrations/202610290001_initial_foundation.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const owner = "11111111-1111-4111-8111-111111111111";
    const other = "22222222-2222-4222-8222-222222222222";
    const course = "33333333-3333-4333-8333-333333333333";
    await db.query("insert into auth.users(id, raw_user_meta_data) values ($1, $3), ($2, '{}')", [
      owner,
      other,
      JSON.stringify({ role: "admin", full_name: "Test Student" }),
    ]);
    const profile = await db.query<{ role: string }>(
      "select role from public.profiles where id = $1",
      [owner],
    );
    assert.equal(profile.rows[0].role, "student", "signup metadata must not assign an admin role");
    await db.query(
      "insert into courses(id, slug, title, price_paise, status) values ($1,'test-course','Test',10000,'published')",
      [course],
    );
    await db.exec(
      "insert into courses(slug,title,price_paise) values ('draft-course','Draft',10000)",
    );
    await db.query(
      "insert into orders(user_id,course_id,base_paise,total_paise,status) values ($1,$2,10000,10000,'paid')",
      [owner, course],
    );
    await assert.rejects(
      db.exec("update orders set base_paise = 9000, total_paise = 9000"),
      /immutable/,
    );
    await assert.rejects(db.exec("update orders set status = 'failed'"), /downgraded/);
    await assert.rejects(
      db.query(
        "insert into orders(user_id,course_id,base_paise,total_paise) values ($1,$2,10000,1)",
        [owner, course],
      ),
      /check constraint/,
    );

    await db.exec("set role anon");
    assert.equal((await db.query("select id from courses")).rows.length, 1);
    await assert.rejects(db.exec("select * from lesson_assets"), /permission denied/);
    await assert.rejects(db.exec("select * from orders"), /permission denied/);
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other]);
    assert.equal((await db.query("select * from orders")).rows.length, 0);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
    assert.equal((await db.query("select * from orders")).rows.length, 1);
    await assert.rejects(db.exec("update profiles set role = 'admin'"), /permission denied/);
    await assert.rejects(
      db.exec(
        "insert into enrollments(user_id,course_id,source) values (gen_random_uuid(),gen_random_uuid(),'manual')",
      ),
      /permission denied/,
    );
    await db.exec("reset role; set role service_role");
    await db.query(
      "insert into webhook_events(provider,payload_hash,payload) values ('cashfree',$1,'{}')",
      ["a".repeat(64)],
    );
    await assert.rejects(
      db.query(
        "insert into webhook_events(provider,payload_hash,payload) values ('cashfree',$1,'{}')",
        ["a".repeat(64)],
      ),
      /unique constraint/,
    );
    await db.exec(
      "insert into audit_log(action,target_type,target_id) values ('test','test','test')",
    );
    await assert.rejects(db.exec("delete from audit_log"), /permission denied/);
    await assert.rejects(db.exec("update audit_log set action = 'tampered'"), /permission denied/);
  } finally {
    await db.close();
  }
});
