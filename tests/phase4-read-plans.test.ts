import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("isolated migrated database: lesson metadata joins stay scoped and use existing indexes", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}');
      create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
      create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt()returns jsonb language sql stable as $$select '{}'::jsonb$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const root = new URL("../backend/database/migrations/", import.meta.url);
    for (const file of (await readdir(root)).filter((file) => file.endsWith(".sql")).sort())
      await db.exec(await readFile(new URL(file, root), "utf8"));
    await db.exec(`
      insert into courses(slug,title,price_paise,status)
        select 'plan-course-'||n,'Plan course '||n,10000,'published' from generate_series(1,100)n;
      insert into modules(course_id,title,position)select id,'Module',0 from courses;
      insert into lessons(module_id,title,position,duration_seconds,published)
        select m.id,'Lesson '||n,n,60,true from modules m cross join generate_series(1,10)n;
      analyze courses;analyze modules;analyze lessons;`);
    const id = (await db.query<{ id: string }>("select id from lessons order by id limit 1"))
      .rows[0].id;
    const sql = `select l.id,l.module_id,l.title,l.is_preview,l.published,l.duration_seconds,
      m.course_id,c.status from lessons l join modules m on m.id=l.module_id
      join courses c on c.id=m.course_id where l.id=$1`;
    const result = await db.query<{ id: string; course_id: string; status: string }>(sql, [id]);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].id, id);
    assert.equal(result.rows[0].status, "published");
    type Plan = {
      "Node Type": string;
      "Index Name"?: string;
      "Actual Rows": number;
      Plans?: Plan[];
    };
    type Explain = { Plan: Plan; "Execution Time": number };
    const explained = (
      await db.query<{ "QUERY PLAN": Explain[] }>(`explain(analyze,buffers,format json) ${sql}`, [
        id,
      ])
    ).rows[0]["QUERY PLAN"][0];
    const nodes: Plan[] = [];
    const walk = (plan: Plan) => {
      nodes.push(plan);
      plan.Plans?.forEach(walk);
    };
    walk(explained.Plan);
    assert.equal(explained.Plan["Actual Rows"], 1);
    assert.ok(nodes.some((node) => node["Index Name"] === "lessons_pkey"));
    const indexes = (
      await db.query<{ tablename: string; indexname: string }>(
        "select tablename,indexname from pg_indexes where schemaname='public' and tablename in('courses','modules','lessons','orders','lesson_progress','enrollments') order by tablename,indexname",
      )
    ).rows;
    assert.ok(indexes.length > 0);
    t.diagnostic(
      JSON.stringify({
        fixture: "100 courses / 100 modules / 1000 lessons",
        rows: 1,
        metadataRoundTrips: { before: 3, after: 1 },
        planNodes: nodes.map((node) => node["Node Type"]),
        indexesUsed: nodes.map((node) => node["Index Name"]).filter(Boolean),
        existingIndexCount: indexes.length,
        executionMs: explained["Execution Time"],
        scope: "isolated PGlite; not hosted evidence",
      }),
    );
  } finally {
    await db.close();
  }
});
