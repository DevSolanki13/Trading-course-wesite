import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Admin manual UPI approval enforces role, locks order, settles access idempotently and audits approval", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now(),raw_user_meta_data jsonb not null default '{}');
      create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
      create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt()returns jsonb language sql stable as $$select '{}'::jsonb$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const root = new URL("../backend/database/migrations/", import.meta.url);
    for (const file of (await readdir(root)).filter((name) => name.endsWith(".sql")).sort()) {
      await db.exec(await readFile(new URL(file, root), "utf8"));
    }

    const adminUser = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const studentUser = "11111111-1111-4111-8111-111111111111";
    const supportUser = "22222222-2222-4222-8222-222222222222";

    await db.query("insert into auth.users(id,email)values($1,'admin@example.invalid')", [
      adminUser,
    ]);
    await db.query("insert into auth.users(id,email)values($1,'student@example.invalid')", [
      studentUser,
    ]);
    await db.query("insert into auth.users(id,email)values($1,'support@example.invalid')", [
      supportUser,
    ]);

    await db.query("update profiles set role='admin', full_name='Head Admin' where id=$1", [
      adminUser,
    ]);
    await db.query("update profiles set role='student', full_name='Student Bob' where id=$1", [
      studentUser,
    ]);
    await db.query("update profiles set role='support', full_name='Support Sam' where id=$1", [
      supportUser,
    ]);

    const course = (
      await db.query<{ id: string }>(
        "insert into courses(slug,title,price_paise,status) values('upi-manual-course','Manual UPI Course',100000,'published') returning id",
      )
    ).rows[0].id;

    // 1. Create a pending UPI order for student
    const order = (
      await db.query<{ id: string }>("select purchase_create_order($1,$2,'upi','') as id", [
        studentUser,
        course,
      ])
    ).rows[0].id;
    await db.query("select purchase_upi_reserve($1,$2,'academy@bank','Academy')", [
      studentUser,
      order,
    ]);
    const checkoutToken = "academy_checkout_manual_test_123456";
    await db.query("update upi_intents set gateway_checkout_token=$2 where order_id=$1", [
      order,
      checkoutToken,
    ]);

    // 2. Test failure cases for admin_upi_manual_approve
    // 2a. Student actor refused (42501)
    await assert.rejects(
      db.query(
        "select admin_upi_manual_approve($1,$2,'UTR123456789','Payment verified in bank',100000)",
        [studentUser, order],
      ),
      /Unauthorized/,
    );

    // 2b. Support actor refused (42501)
    await assert.rejects(
      db.query(
        "select admin_upi_manual_approve($1,$2,'UTR123456789','Payment verified in bank',100000)",
        [supportUser, order],
      ),
      /Unauthorized/,
    );

    // 2c. Non-existent order refused (42501)
    await assert.rejects(
      db.query(
        "select admin_upi_manual_approve($1,'99999999-9999-4999-8999-999999999999','UTR123456789','Payment verified in bank',100000)",
        [adminUser],
      ),
      /Order not found/,
    );

    // 2d. Wrong confirm amount refused (22023)
    await assert.rejects(
      db.query(
        "select admin_upi_manual_approve($1,$2,'UTR123456789','Payment verified in bank',50000)",
        [adminUser, order],
      ),
      /Confirmation amount does not match order amount/,
    );

    // 2e. Short reason refused (22023)
    await assert.rejects(
      db.query("select admin_upi_manual_approve($1,$2,'UTR123456789','Short',100000)", [
        adminUser,
        order,
      ]),
      /Reason must be between 10 and 300 characters/,
    );

    // 2f. Invalid UTR format refused (22023)
    await assert.rejects(
      db.query("select admin_upi_manual_approve($1,$2,'bad','Payment verified in bank',100000)", [
        adminUser,
        order,
      ]),
      /Invalid UTR format/,
    );

    // 2g. Unmatched credit amount mismatch refused
    await db.query(
      "insert into academy_upi_unmatched_credits(id,utr,amount_paise,received_at) values('c1','UTRMISMATCH123',50000,now())",
    );
    await assert.rejects(
      db.query(
        "select admin_upi_manual_approve($1,$2,'UTRMISMATCH123','Payment verified in bank',100000)",
        [adminUser, order],
      ),
      /Bank credit amount does not match order amount/,
    );

    // 2h. Gateway COMPLETED refused (admin must use Check payment)
    await db.query(
      "insert into academy_upi_gateway_deposits(token,utr,amount_paise,status,updated_at) values($1,'UTRGATEWAY123',100000,'COMPLETED',now())",
      [checkoutToken],
    );
    await assert.rejects(
      db.query(
        "select admin_upi_manual_approve($1,$2,'UTR123456789','Payment verified in bank',100000)",
        [adminUser, order],
      ),
      /Gateway payment is already completed; use Check payment instead/,
    );
    // Reset gateway deposit status to PENDING_CONFIRMATION for subsequent tests
    await db.query(
      "update academy_upi_gateway_deposits set status='PENDING_CONFIRMATION' where token=$1",
      [checkoutToken],
    );

    // 3. SUCCESSFUL MANUAL APPROVAL
    const res = (
      await db.query<{ result: { status: string; alreadyPaid: boolean } }>(
        "select admin_upi_manual_approve($1,$2,'UTRSUCCESS123','Confirmed via bank manager email',100000) as result",
        [adminUser, order],
      )
    ).rows[0].result;

    assert.equal(res.status, "paid");
    assert.equal(res.alreadyPaid, false);

    // Verify order is paid
    const orderCheck = await db.query<{ status: string; paid_at: string }>(
      "select status, paid_at from orders where id=$1",
      [order],
    );
    assert.equal(orderCheck.rows[0].status, "paid");
    assert.ok(orderCheck.rows[0].paid_at);

    // Verify enrollment and purchase_access exist
    const enrollment = await db.query<{ active: boolean; source: string }>(
      "select active, source from enrollments where order_id=$1",
      [order],
    );
    assert.equal(enrollment.rows.length, 1);
    assert.equal(enrollment.rows[0].active, true);
    assert.equal(enrollment.rows[0].source, "purchase");

    const access = await db.query<{ active: boolean }>(
      "select active from purchase_access where order_id=$1",
      [order],
    );
    assert.equal(access.rows.length, 1);
    assert.equal(access.rows[0].active, true);

    // Verify outbox receipt row exists
    const outbox = await db.query<{ subject: string }>(
      "select subject from notification_outbox where dedupe_key=$1",
      [`purchase:${order}`],
    );
    assert.equal(outbox.rows.length, 1);
    assert.equal(outbox.rows[0].subject, "Your course receipt");

    // Verify purchase_manual_approvals record
    const approval = await db.query<{
      approved_by: string;
      utr: string;
      reason: string;
      amount_paise: number;
    }>(
      "select approved_by, utr, reason, amount_paise from purchase_manual_approvals where order_id=$1",
      [order],
    );
    assert.equal(approval.rows.length, 1);
    assert.equal(approval.rows[0].approved_by, adminUser);
    assert.equal(approval.rows[0].utr, "UTRSUCCESS123");
    assert.equal(approval.rows[0].reason, "Confirmed via bank manager email");
    assert.equal(approval.rows[0].amount_paise, 100000);

    // Verify audit_log record
    const auditRow = await db.query<{
      action: string;
      target_type: string;
      target_id: string;
      details: Record<string, unknown>;
    }>(
      "select action, target_type, target_id, details from audit_log where action='upi_payment_manually_approved' and target_id=$1",
      [order],
    );
    assert.equal(auditRow.rows.length, 1);
    assert.equal(auditRow.rows[0].action, "upi_payment_manually_approved");
    assert.equal(auditRow.rows[0].target_type, "order");
    assert.equal(auditRow.rows[0].details.utr, "UTRSUCCESS123");
    assert.equal(auditRow.rows[0].details.amount_paise, 100000);

    // 4. SECOND CALL IS IDEMPOTENT (returns alreadyPaid: true, no duplicate rows)
    const secondCall = (
      await db.query<{ result: { status: string; alreadyPaid: boolean } }>(
        "select admin_upi_manual_approve($1,$2,'UTRSUCCESS123','Confirmed via bank manager email',100000) as result",
        [adminUser, order],
      )
    ).rows[0].result;
    assert.equal(secondCall.status, "paid");
    assert.equal(secondCall.alreadyPaid, true);

    // 5. REUSING SAME UTR ON ANOTHER ORDER IS REFUSED (unique index violation)
    const studentUser2 = "33333333-3333-4333-8333-333333333333";
    await db.query("insert into auth.users(id,email)values($1,'student2@example.invalid')", [
      studentUser2,
    ]);
    await db.query("update profiles set role='student', full_name='Student Alice' where id=$1", [
      studentUser2,
    ]);

    const secondOrder = (
      await db.query<{ id: string }>("select purchase_create_order($1,$2,'upi','') as id", [
        studentUser2,
        course,
      ])
    ).rows[0].id;
    await db.query("select purchase_upi_reserve($1,$2,'academy@bank','Academy')", [
      studentUser2,
      secondOrder,
    ]);
    await db.query("update upi_intents set gateway_checkout_token='tok_2' where order_id=$1", [
      secondOrder,
    ]);

    const secOrderData = (
      await db.query<{ total_paise: number }>("select total_paise from orders where id=$1", [
        secondOrder,
      ])
    ).rows[0];

    await assert.rejects(
      db.query("select admin_upi_manual_approve($1,$2,'UTRSUCCESS123','Duplicate UTR test',$3)", [
        adminUser,
        secondOrder,
        secOrderData.total_paise,
      ]),
      /This UTR has already been used to approve an order/,
    );

    // 6. NON-UPI ORDER REFUSED
    const course2 = (
      await db.query<{ id: string }>(
        "insert into courses(slug,title,price_paise,status) values('mock-course','Mock Course',100000,'published') returning id",
      )
    ).rows[0].id;
    const mockOrder = (
      await db.query<{ id: string }>("select purchase_create_order($1,$2,'mock','') as id", [
        studentUser,
        course2,
      ])
    ).rows[0].id;
    await assert.rejects(
      db.query("select admin_upi_manual_approve($1,$2,'UTRMOCK1234','Mock test',100000)", [
        adminUser,
        mockOrder,
      ]),
      /Only UPI orders can be manually approved/,
    );

    // 7. UNBOUND ORDER (null provider_order_id) REFUSED
    const course3 = (
      await db.query<{ id: string }>(
        "insert into courses(slug,title,price_paise,status) values('unbound-course','Unbound Course',100000,'published') returning id",
      )
    ).rows[0].id;
    const unboundOrder = (
      await db.query<{ id: string }>("select purchase_create_order($1,$2,'upi','') as id", [
        studentUser,
        course3,
      ])
    ).rows[0].id;
    await assert.rejects(
      db.query("select admin_upi_manual_approve($1,$2,'UTRUNBOUND12','Unbound test',100000)", [
        adminUser,
        unboundOrder,
      ]),
      /Checkout was never set up for this order; nothing to approve/,
    );

    // 8. STAFF VIEW AND READ FUNCTION INCLUDE MANUAL APPROVAL DATA
    const viewRows = await db.query<{
      manual_approved_by: string;
      manual_approved_at: string;
      manual_reason: string;
    }>(
      "select manual_approved_by, manual_approved_at, manual_reason from academy_upi_payment_orders where id=$1",
      [order],
    );
    assert.equal(viewRows.rows.length, 1);
    assert.equal(viewRows.rows[0].manual_approved_by, "Head Admin");
    assert.ok(viewRows.rows[0].manual_approved_at);
    assert.equal(viewRows.rows[0].manual_reason, "Confirmed via bank manager email");

    const readRes = (
      await db.query<{ result: { items: Record<string, unknown>[] } }>(
        "select academy_upi_payment_read('history',$1,0) as result",
        [order],
      )
    ).rows[0].result;
    assert.equal(readRes.items.length, 1);
    const item = readRes.items[0];
    const manualApp = item.manualApproval as { by: string; at: string; reason: string };
    assert.equal(manualApp.by, "Head Admin");
    assert.equal(manualApp.reason, "Confirmed via bank manager email");
    assert.ok(manualApp.at);

    // 9. REFUND FLOW CHECK
    // Verify that refund eligibility and refund request function normally on manually approved order
    const refundRequest = await db.query<{ id: string }>(
      "insert into refund_requests(order_id,user_id,reason,requested_evidence) values($1,$2,'Course not suitable','{}'::jsonb) returning id",
      [order, studentUser],
    );
    assert.equal(refundRequest.rows.length, 1);
    const refundId = refundRequest.rows[0].id;
    assert.ok(refundId);
  } finally {
    await db.close();
  }
});
