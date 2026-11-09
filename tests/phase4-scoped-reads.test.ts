import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("phase 4 scoped course and refund pages preserve legacy results and staff boundaries", async (t) => {
  const db = new PGlite();
  const users = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
  ];
  const sessions = [
    "44444444-4444-4444-8444-444444444441",
    "44444444-4444-4444-8444-444444444442",
    "44444444-4444-4444-8444-444444444443",
  ];
  const value = async <T>(sql: string, args: unknown[] = []) =>
    (await db.query<{ v: T }>(sql, args)).rows[0].v;
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now(),raw_user_meta_data jsonb not null default '{}');
      create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const root = new URL("../backend/database/migrations/", import.meta.url);
    for (const file of (await readdir(root)).filter((f) => f.endsWith(".sql")).sort())
      await db.exec(await readFile(new URL(file, root), "utf8"));
    for (let i = 0; i < users.length; i++) {
      await db.query("insert into auth.users(id,email)values($1,$2)", [
        users[i],
        `scoped-${i}@example.invalid`,
      ]);
      await db.query("insert into auth.sessions(id,user_id)values($1,$2)", [sessions[i], users[i]]);
      await db.query("select auth_admit_device($1,$2,'Fixture',true,null)", [
        users[i],
        sessions[i],
      ]);
    }
    await db.query("update profiles set role='admin' where id=$1", [users[0]]);
    await db.query("update profiles set role='support' where id=$1", [users[1]]);
    await db.exec(`insert into courses(slug,title,price_paise,status)
      select 'scoped-course-'||n,'Scoped course '||n,10000,'published' from generate_series(1,100)n;
      insert into modules(course_id,title,position)select id,'Start',0 from courses;
      insert into lessons(module_id,title,position,duration_seconds,published,is_preview)
        select m.id,'Lesson '||n,n,100,n<3,n=1 from modules m cross join generate_series(1,3)n;`);
    const course = await value<string>("select id as v from courses where slug='scoped-course-1'");
    const lesson = await value<string>(
      "select l.id as v from lessons l join modules m on m.id=l.module_id where m.course_id=$1 and l.position=2",
      [course],
    );
    await db.query("insert into enrollments(user_id,course_id,source)values($1,$2,'manual')", [
      users[2],
      course,
    ]);
    await db.query(
      "insert into lesson_progress(user_id,lesson_id,duration_seconds,completed,watched)values($1,$2,100,true,'{[0,100000)}')",
      [users[2], lesson],
    );

    await t.test(
      "selected course equals legacy catalog for anonymous, owner and unrelated users",
      async () => {
        for (const user of [null, ...users]) {
          for (const ref of [course, "scoped-course-1"]) {
            const legacy = await value("select purchase_read_before_upi('course',$1,$2) as v", [
              user,
              ref,
            ]);
            const current = await value("select purchase_read('course',$1,$2) as v", [user, ref]);
            assert.deepEqual(current, legacy);
          }
        }
        assert.equal(await value("select purchase_read('course',null,'missing') as v"), null);
        await db.query(
          "update enrollments set expires_at=now()-interval '1 second' where user_id=$1",
          [users[2]],
        );
        assert.deepEqual(
          await value("select purchase_read('course',$1,$2) as v", [users[2], course]),
          await value("select purchase_read_before_upi('course',$1,$2) as v", [users[2], course]),
        );
        await db.query("update profiles set blocked=true where id=$1", [users[2]]);
        assert.deepEqual(
          await value("select purchase_read('course',$1,$2) as v", [users[2], course]),
          await value("select purchase_read_before_upi('course',$1,$2) as v", [users[2], course]),
        );
        await db.query("update profiles set blocked=false where id=$1", [users[2]]);
        await db.query("update courses set status='draft' where id=$1", [course]);
        assert.equal(
          await value("select purchase_read('course',$1,$2) as v", [users[2], course]),
          null,
        );
        await db.query("update courses set status='published' where id=$1", [course]);
      },
    );

    const snapshot = JSON.stringify({
      watch_tracking_version: 1,
      duration_seconds: 100,
      lessons: [{ id: lesson, duration_seconds: 100, is_preview: false }],
    });
    await db.query(
      `insert into orders(user_id,course_id,status,base_paise,total_paise,paid_at,course_snapshot)
      select $1,$2,'paid',10000,10000,now()-interval '1 minute',$3::jsonb from generate_series(1,55)`,
      [users[2], course, snapshot],
    );
    await db.exec(`insert into refund_requests(order_id,user_id,reason,requested_evidence)
      select id,user_id,'Review requested','{}'::jsonb from orders;`);
    type RefundPage = {
      items: { id: string; order_id: string; current_evidence: unknown }[];
      total: number;
    };
    const page = (actor: number, n = 0, state: string | null = null) =>
      value<RefundPage>("select admin_refund_page_v2($1,$2,$3,$4) as v", [
        users[actor],
        sessions[actor],
        state,
        n,
      ]);
    await t.test("batched evidence is identical and ties cannot drop or repeat rows", async () => {
      const first = await page(0);
      const second = await page(1, 1);
      assert.equal(first.total, 55);
      assert.equal(first.items.length, 50);
      assert.equal(second.items.length, 5);
      assert.equal(new Set([...first.items, ...second.items].map((r) => r.id)).size, 55);
      for (const row of [...first.items, ...second.items])
        assert.deepEqual(
          row.current_evidence,
          await value("select refund_evidence($1) as v", [row.order_id]),
        );
      assert.deepEqual((await page(0, 2)).items, []);
      assert.equal((await page(0, 0, "failed")).total, 0);
      assert.deepEqual(await page(0), await page(1));
      await db.query(
        "insert into order_watch_ranges(order_id,lesson_id,watched)values($1,$2,'{[0,50000)}')",
        [first.items[0].order_id, lesson],
      );
      const refreshed = await page(0);
      assert.notDeepEqual(refreshed.items[0].current_evidence, first.items[0].current_evidence);
    });
    await t.test(
      "student, revoked session, invalid page and public roles cannot use staff reads",
      async () => {
        await assert.rejects(page(2), /Role denied/);
        await assert.rejects(page(0, -1), /Invalid refund page/);
        await assert.rejects(page(0, 0, "bad"), /Invalid refund page/);
        await db.query("update device_sessions set revoked_at=now() where auth_session_id=$1", [
          sessions[1],
        ]);
        await assert.rejects(page(1), /Session denied/);
        for (const role of ["anon", "authenticated"])
          assert.equal(
            await value<boolean>(
              "select has_function_privilege($1,'public.admin_refund_page_v2(uuid,uuid,text,integer)','execute') as v",
              [role],
            ),
            false,
          );
        await db.exec("set role service_role");
        assert.equal((await page(0)).total, 55);
        await db.exec("reset role");
      },
    );
    const plan = await db.query(
      "explain(analyze,buffers,format json) select purchase_course_v2($1,$2)",
      [users[2], course],
    );
    const samples: Record<string, number[]> = { legacy: [], scoped: [] };
    let resultBytes = 0;
    for (let n = 0; n < 7; n++) {
      for (const [kind, sql] of [
        ["legacy", "select purchase_read_before_upi('course',$1,$2) as v"],
        ["scoped", "select purchase_read('course',$1,$2) as v"],
      ]) {
        const started = performance.now();
        const result = await value(sql, [users[2], course]);
        samples[kind].push(performance.now() - started);
        resultBytes = Buffer.byteLength(JSON.stringify(result));
      }
    }
    const timings = Object.fromEntries(
      Object.entries(samples).map(([kind, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        return [kind, { samples: sorted.length, medianMs: sorted[3], p95Ms: sorted[6] }];
      }),
    );
    t.diagnostic(
      JSON.stringify({
        fixture: "100 courses / 300 lessons / 55 refund requests",
        courseReadPlan: plan.rows,
        courseTimings: timings,
        selectedPayloadBytes: resultBytes,
        refundRemoteCalls: { before: "1 list plus up to 50 evidence RPCs", after: 1 },
        scope: "isolated fixture, not hosted latency",
      }),
    );
  } finally {
    await db.close();
  }
});
