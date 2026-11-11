import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("announcement RLS hides inactive rows, denies public writes and preserves service management", async () => {
  const db = new PGlite();
  try {
    // Include Supabase-style default grants so RLS is not the only write fence.
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    `);
    for (const name of ["202611020019_announcements.sql", "202611110031_announcements_rls.sql"]) {
      await db.exec(
        await readFile(new URL(`../backend/database/migrations/${name}`, import.meta.url), "utf8"),
      );
    }
    await db.exec(`
      delete from public.announcements;
      insert into public.announcements(title, content, active)
      values ('Published', 'Public notice', true), ('Draft', 'Private draft', false);
    `);
    assert.equal(
      (
        await db.query<{ enabled: boolean }>(
          "select relrowsecurity as enabled from pg_class where oid = 'public.announcements'::regclass",
        )
      ).rows[0].enabled,
      true,
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      assert.deepEqual((await db.query("select title from public.announcements")).rows, [
        { title: "Published" },
      ]);
      for (const sql of [
        "insert into public.announcements(title, content) values ('Injected', 'Bad')",
        "update public.announcements set active = true",
        "delete from public.announcements",
        "truncate public.announcements",
      ]) {
        await assert.rejects(db.exec(sql), /permission denied/);
      }
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    assert.equal((await db.query("select * from public.announcements")).rows.length, 2);
    await db.exec(`
      insert into public.announcements(title, content, active) values ('Managed', 'Admin notice', false);
      update public.announcements set active = true where title = 'Managed';
    `);
    assert.deepEqual(
      (await db.query("select active from public.announcements where title = 'Managed'")).rows,
      [{ active: true }],
    );
    await db.exec("delete from public.announcements where title = 'Managed'");
    assert.equal((await db.query("select * from public.announcements")).rows.length, 2);
  } finally {
    await db.close();
  }
});
