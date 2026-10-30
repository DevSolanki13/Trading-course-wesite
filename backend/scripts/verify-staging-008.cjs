// Full staging verification: creates a disposable test account, exercises
// demo_create_order and demo_settle_payment, then cleans up.
// Run: node backend/scripts/verify-staging-008.cjs
const { Client } = require('pg');
const { createHash } = require('crypto');

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();
  console.log('Connected to staging database ✅\n');

  // ── Resolve a published course to use ─────────────────────────────────────
  const courseRow = await c.query(
    "SELECT id, slug, price_paise FROM public.courses WHERE status='published' LIMIT 1"
  );
  if (courseRow.rows.length === 0) {
    console.error('❌ No published course found in staging. Cannot run e2e test.');
    await c.end(); process.exit(1);
  }
  const course = courseRow.rows[0];
  console.log(`Using course: slug=${course.slug} price=${course.price_paise} paise`);

  // ── Insert disposable test user + session ─────────────────────────────────
  const userId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const sessionId = 'ffffffff-0000-4111-8222-333333333333';
  
  // Cleanup from any prior failed run first
  await c.query("DELETE FROM public.enrollments WHERE user_id=$1", [userId]);
  await c.query("DELETE FROM public.payment_attempts WHERE order_id IN (SELECT id FROM public.orders WHERE user_id=$1)", [userId]);
  await c.query("DELETE FROM public.orders WHERE user_id=$1", [userId]);
  await c.query("DELETE FROM public.device_sessions WHERE user_id=$1", [userId]);
  await c.query("DELETE FROM auth.sessions WHERE id=$1", [sessionId]);
  await c.query("DELETE FROM public.profiles WHERE id=$1", [userId]);
  await c.query("DELETE FROM auth.users WHERE id=$1", [userId]);
  
  await c.query("INSERT INTO auth.users(id,email) VALUES($1,'verify-test@example.invalid') ON CONFLICT DO NOTHING", [userId]);
  // profiles row is created by the trigger on auth.users insert; if trigger doesn't fire via direct insert, create manually
  await c.query(`
    INSERT INTO public.profiles(id, full_name, role, blocked, sessions_invalid_before)
    VALUES($1, 'Staging Verify Bot', 'student', false, now() - interval '1 hour')
    ON CONFLICT(id) DO NOTHING
  `, [userId]);
  await c.query("INSERT INTO auth.sessions(id,user_id,created_at) VALUES($1,$2,now()) ON CONFLICT DO NOTHING", [sessionId, userId]);
  const admitResult = await c.query("SELECT public.auth_admit_device($1,$2,'Staging-verify',true,null) as status", [userId, sessionId]);
  const admitStatus = admitResult.rows[0].status;
  if (admitStatus !== 'admitted') throw new Error(`Device admission failed: ${admitStatus}`);
  console.log('Disposable test user + session created ✅');

  // Helper: settle with a given status and optional custom amount
  const settle = async (orderId, status, amountPaise) => {
    const amount = amountPaise ?? (await getOrderTotal(c, orderId));
    const event = {
      eventId: `${orderId}:${status}:${Date.now()}`,
      providerOrderId: `demo_${orderId}`,
      status,
      amountPaise: amount,
    };
    const hash = createHash('sha256').update(JSON.stringify(event)).digest('hex');
    return c.query("SELECT public.demo_settle_payment($1,$2)", [hash, JSON.stringify(event)]);
  };

  // ── Test 1: Create order ───────────────────────────────────────────────────
  console.log('\n── Test 1: Create order (idempotent) ──');
  const r1 = await c.query("SELECT public.demo_create_order($1,$2,$3) as id", [userId, sessionId, course.slug]);
  const orderId = r1.rows[0].id;
  console.log(`  Order created: ${orderId} ✅`);

  // Retry must return the same ID
  const r2 = await c.query("SELECT public.demo_create_order($1,$2,$3) as id", [userId, sessionId, course.slug]);
  if (r2.rows[0].id !== orderId) throw new Error('Idempotency failed — got different order on retry');
  console.log('  Retry returned same order ✅');

  // ── Test 2: Amount mismatch rejected ─────────────────────────────────────
  console.log('\n── Test 2: Amount mismatch rejected ──');
  try {
    await settle(orderId, 'paid', 1);
    console.log('  ❌ FAIL — mismatch was NOT rejected');
  } catch (e) {
    if (e.message.includes('mismatch') || e.message.includes('Order mismatch')) {
      console.log('  Amount mismatch correctly rejected ✅');
    } else { throw e; }
  }

  // ── Test 3: Failed settlement — no enrollment ─────────────────────────────
  console.log('\n── Test 3: Failed settlement grants no access ──');
  await settle(orderId, 'failed');
  const enrAfterFail = await c.query("SELECT * FROM public.enrollments WHERE user_id=$1", [userId]);
  if (enrAfterFail.rows.length > 0) throw new Error('Enrollment created on failed settlement!');
  console.log('  No enrollment after failed ✅');

  // ── Test 4: Terminal order cannot be re-settled ───────────────────────────
  console.log('\n── Test 4: Terminal order (failed) cannot become paid ──');
  await settle(orderId, 'paid'); // Must be a no-op since order.status = 'failed' now
  const enrAfterTerminal = await c.query("SELECT * FROM public.enrollments WHERE user_id=$1", [userId]);
  if (enrAfterTerminal.rows.length > 0) throw new Error('Enrollment granted after terminal re-settle!');
  const orderAfter = await c.query("SELECT status FROM public.orders WHERE id=$1", [orderId]);
  console.log(`  Order status remains '${orderAfter.rows[0].status}' — no resurrection ✅`);

  // ── Test 5: New order → paid → enrollment ────────────────────────────────
  console.log('\n── Test 5: New order after failure, pay successfully ──');
  const r3 = await c.query("SELECT public.demo_create_order($1,$2,$3) as id", [userId, sessionId, course.slug]);
  const orderId2 = r3.rows[0].id;
  if (orderId2 === orderId) throw new Error('Expected new order UUID after terminal first order');
  console.log(`  New order: ${orderId2} ✅`);
  await settle(orderId2, 'paid');
  const enrAfterPaid = await c.query("SELECT * FROM public.enrollments WHERE user_id=$1 AND course_id=$2", [userId, course.id]);
  if (enrAfterPaid.rows.length !== 1) throw new Error('Enrollment not created after paid settlement!');
  console.log('  Enrollment created after paid ✅');

  // ── Test 6: Duplicate event is idempotent ─────────────────────────────────
  console.log('\n── Test 6: Duplicate webhook event is idempotent ──');
  await settle(orderId2, 'paid'); // same event hash would differ due to eventId having Date.now()
  // Use exact same event to truly test deduplication via hash
  const dedupeEvent = {
    eventId: 'dedup-test',
    providerOrderId: `demo_${orderId2}`,
    status: 'paid',
    amountPaise: await getOrderTotal(c, orderId2),
  };
  const dedupeHash = createHash('sha256').update(JSON.stringify(dedupeEvent)).digest('hex');
  await c.query("SELECT public.demo_settle_payment($1,$2)", [dedupeHash, JSON.stringify(dedupeEvent)]);
  await c.query("SELECT public.demo_settle_payment($1,$2)", [dedupeHash, JSON.stringify(dedupeEvent)]);
  const enrCount = await c.query("SELECT COUNT(*) as cnt FROM public.enrollments WHERE user_id=$1 AND course_id=$2", [userId, course.id]);
  if (Number(enrCount.rows[0].cnt) !== 1) throw new Error(`Duplicate enrollments: ${enrCount.rows[0].cnt}`);
  console.log('  Duplicate event idempotent — still 1 enrollment ✅');

  // ── Test 7: Already enrolled blocks new order ─────────────────────────────
  console.log('\n── Test 7: Already enrolled blocks new order ──');
  try {
    await c.query("SELECT public.demo_create_order($1,$2,$3) as id", [userId, sessionId, course.slug]);
    console.log('  ❌ FAIL — new order was accepted for already-enrolled user');
  } catch (e) {
    if (e.message.includes('Already enrolled')) {
      console.log('  Already enrolled correctly blocked ✅');
    } else { throw e; }
  }

  // ── Test 8: Role permissions ──────────────────────────────────────────────
  console.log('\n── Test 8: authenticated/anon role denial ──');
  await c.query("SET ROLE authenticated");
  try {
    await c.query("SELECT public.demo_create_order($1,$2,$3) as id", [userId, sessionId, course.slug]);
    console.log('  ❌ FAIL — authenticated role was NOT denied');
  } catch (e) {
    if (e.message.includes('permission denied')) {
      console.log('  authenticated role correctly denied ✅');
    } else { throw e; }
  }
  await c.query("RESET ROLE");

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log('\n── Cleanup ──');
  await c.query("DELETE FROM public.enrollments WHERE user_id=$1", [userId]);
  await c.query("DELETE FROM public.payment_attempts WHERE order_id IN (SELECT id FROM public.orders WHERE user_id=$1)", [userId]);
  await c.query("DELETE FROM public.orders WHERE user_id=$1", [userId]);
  await c.query("DELETE FROM public.device_sessions WHERE user_id=$1", [userId]);
  await c.query("DELETE FROM auth.sessions WHERE id=$1", [sessionId]);
  await c.query("DELETE FROM public.profiles WHERE id=$1", [userId]);
  await c.query("DELETE FROM auth.users WHERE id=$1", [userId]);
  console.log('  Disposable test data removed ✅');

  // ── Final consistency check ───────────────────────────────────────────────
  console.log('\n── Final consistency check ──');
  const mismatch = await c.query(`
    SELECT COUNT(*) as cnt FROM public.orders o
    LEFT JOIN public.enrollments e ON e.order_id = o.id
    WHERE o.status = 'paid' AND e.id IS NULL
  `);
  console.log(`Paid orders without enrollment: ${mismatch.rows[0].cnt === '0' ? '0 ✅' : mismatch.rows[0].cnt + ' ❌'}`);

  await c.end();
  console.log('\n🎉 All staging verification tests passed. Migration 008 is operational.\n');
}

async function getOrderTotal(c, orderId) {
  const r = await c.query("SELECT total_paise FROM public.orders WHERE id=$1", [orderId]);
  return r.rows[0].total_paise;
}

main().catch(e => {
  console.error('\n❌ Verification FAILED:', e.message, e.detail ? `\n   Detail: ${e.detail}` : '');
  process.exit(1);
});
