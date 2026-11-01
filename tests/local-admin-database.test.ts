import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { localAdminRead } from "../backend/local/admin.ts";

test("local admin uses the learner database for every workspace list and detail", async () => {
  const db = new PGlite();
  const student = "11111111-1111-4111-8111-111111111111";
  const admin = "22222222-2222-4222-8222-222222222222";
  const url = (query = "") => new URL(`http://localhost/api/admin/test${query}`);
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}');
      create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema public,auth to anon,authenticated,service_role;
    `);
    const root = new URL("../backend/database/migrations/", import.meta.url);
    for (const file of (await readdir(root)).filter((name) => name.endsWith(".sql")).sort()) {
      await db.exec(await readFile(new URL(file, root), "utf8"));
    }
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,'learner@example.com','{\"full_name\":\"Learner\"}'),($2,'staff@example.com','{}')",
      [student, admin],
    );
    await db.query("update profiles set role='admin' where id=$1", [admin]);
    const course = (
      await db.query<{ id: string }>(
        "insert into courses(slug,title,price_paise,status) values('regression-course','Regression course',10000,'published') returning id",
      )
    ).rows[0].id;
    const order = (
      await db.query<{ id: string }>(
        "insert into orders(user_id,course_id,purchase_provider,status,base_paise,total_paise,paid_at,course_snapshot) values($1,$2,'mock','paid',10000,10000,now(),'{\"title\":\"Regression course\"}') returning id",
        [student, course],
      )
    ).rows[0].id;
    await db.query(
      "insert into enrollments(user_id,course_id,order_id,source,active) values($1,$2,$3,'purchase',true)",
      [student, course, order],
    );

    for (const action of [
      "students",
      "orders",
      "export",
      "order-filters",
      "refunds",
      "settings",
      "content",
      "coupons",
      "audit",
      "tasks",
      "notifications",
    ]) {
      assert.ok(await localAdminRead(db, action, url()), `${action} must read locally`);
    }
    const students = await localAdminRead(db, "students", url());
    assert.equal(students?.total, 2);
    const support = await localAdminRead(db, "students", url(), "support");
    assert.equal(support?.total, 1, "support must not see staff accounts");
    assert.equal((await localAdminRead(db, "students", url(`?q=${student}`)))?.total, 1);
    assert.equal((await localAdminRead(db, "students", url("?q=missing")))?.total, 0);
    assert.equal((await localAdminRead(db, "students", url("?page=1")))?.total, 2);
    assert.deepEqual((await localAdminRead(db, "students", url("?page=1")))?.items, []);
    assert.equal((await localAdminRead(db, "orders", url("?status=paid")))?.total, 1);
    assert.equal((await localAdminRead(db, "orders", url("?status=failed")))?.total, 0);
    assert.equal(
      (await localAdminRead(db, "orders", url(`?courseId=${course}&userId=${student}`)))?.total,
      1,
    );
    assert.equal(
      (await localAdminRead(db, "orders", url("?from=2000-01-01&to=2000-01-02")))?.total,
      0,
    );
    const detail = await localAdminRead(db, "order", url(`?id=${order}`));
    assert.equal((detail?.order as { id: string }).id, order);
    assert.equal(detail?.providerActionsAvailable, false);
    const learner = await localAdminRead(db, "student", url(`?id=${student}`));
    assert.equal((learner?.enrollments as unknown[]).length, 1);
    assert.equal(await localAdminRead(db, "student", url(`?id=${admin}`), "support"), null);
    assert.equal(await localAdminRead(db, "student", url("?id=invalid")), null);
    assert.equal(await localAdminRead(db, "order", url("?id=invalid")), null);
    assert.equal(await localAdminRead(db, "unknown", url()), undefined);
    const purchase = await db.query<{ data: { owned: boolean } }>(
      "select public.purchase_read('course',$1,'regression-course') as data",
      [student],
    );
    assert.equal(
      purchase.rows[0].data.owned,
      true,
      "admin reads must preserve student purchase access",
    );
  } finally {
    await db.close();
  }
});
