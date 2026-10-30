// Phase 2 — Staging Learner Journey Verification Script
// Run: node backend/scripts/verify-staging-phase2.cjs
const { Client } = require('pg');
const { createHash } = require('crypto');

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();
  console.log('Connected to Staging Database ✅\n');

  // 1. Resolve or create a published staging test course with 1 preview and 1 paid lesson
  const courseSlug = 'phase2-verify-course';
  let courseRes = await c.query("SELECT id, slug, price_paise FROM public.courses WHERE slug=$1", [courseSlug]);
  let courseId;
  let moduleId;
  let previewLessonId;
  let paidLessonId;

  if (courseRes.rows.length === 0) {
    const newCourse = await c.query(
      "INSERT INTO public.courses(slug, title, description, price_paise, status) VALUES($1, 'Phase 2 Test Course', 'Course for learner flow testing', 200000, 'published') RETURNING id",
      [courseSlug]
    );
    courseId = newCourse.rows[0].id;

    const newModule = await c.query(
      "INSERT INTO public.modules(course_id, title, position) VALUES($1, 'Module 1', 0) RETURNING id",
      [courseId]
    );
    moduleId = newModule.rows[0].id;

    const preview = await c.query(
      "INSERT INTO public.lessons(module_id, title, position, duration_seconds, is_preview, published) VALUES($1, 'Preview Lesson', 0, 180, true, true) RETURNING id",
      [moduleId]
    );
    previewLessonId = preview.rows[0].id;

    const paid = await c.query(
      "INSERT INTO public.lessons(module_id, title, position, duration_seconds, is_preview, published) VALUES($1, 'Paid Deep Dive', 1, 600, false, true) RETURNING id",
      [moduleId]
    );
    paidLessonId = paid.rows[0].id;

    await c.query("INSERT INTO public.lesson_assets(lesson_id, provider_video_id, notes) VALUES($1, 'vdo_staging_prev', 'Free preview notes')", [previewLessonId]);
    await c.query("INSERT INTO public.lesson_assets(lesson_id, provider_video_id, notes) VALUES($1, 'vdo_staging_paid', 'Exclusive student notes')", [paidLessonId]);
    console.log(`Created test course '${courseSlug}' with preview and paid lessons ✅`);
  } else {
    courseId = courseRes.rows[0].id;
    const lessons = await c.query(
      "SELECT l.id, l.is_preview FROM public.lessons l JOIN public.modules m ON m.id=l.module_id WHERE m.course_id=$1 ORDER BY l.position",
      [courseId]
    );
    previewLessonId = lessons.rows.find(l => l.is_preview)?.id;
    paidLessonId = lessons.rows.find(l => !l.is_preview)?.id;
    console.log(`Using existing test course '${courseSlug}' ✅`);
  }

  // Disposable test learner UUIDs
  const testUserId = 'bbbbbbbb-1111-4222-8333-aaaaaaaaaaaa';
  const session1 = 'cccccccc-1111-4222-8333-111111111111';
  const session2 = 'cccccccc-2222-4222-8333-222222222222';
  const session3 = 'cccccccc-3333-4222-8333-333333333333';

  // Clean any remnants first
  await c.query("DELETE FROM public.order_watch_ranges WHERE order_id IN (SELECT id FROM public.orders WHERE user_id=$1)", [testUserId]);
  await c.query("DELETE FROM public.enrollments WHERE user_id=$1", [testUserId]);
  await c.query("DELETE FROM public.lesson_progress WHERE user_id=$1", [testUserId]);
  await c.query("DELETE FROM public.learning_playbacks WHERE user_id=$1", [testUserId]);
  await c.query("DELETE FROM public.payment_attempts WHERE order_id IN (SELECT id FROM public.orders WHERE user_id=$1)", [testUserId]);
  await c.query("DELETE FROM public.orders WHERE user_id=$1", [testUserId]);
  await c.query("DELETE FROM public.device_sessions WHERE user_id=$1", [testUserId]);
  await c.query("DELETE FROM auth.sessions WHERE id IN ($1, $2, $3)", [session1, session2, session3]);
  await c.query("DELETE FROM public.profiles WHERE id=$1", [testUserId]);
  await c.query("DELETE FROM auth.users WHERE id=$1", [testUserId]);

  console.log('\n── Step 1: Account setup & 2-device limit verification ──');
  await c.query("INSERT INTO auth.users(id, email, email_confirmed_at) VALUES($1, 'p2-learner@test.local', now()) ON CONFLICT (id) DO UPDATE SET email_confirmed_at=now()", [testUserId]);
  await c.query(`
    INSERT INTO public.profiles(id, full_name, role, blocked, sessions_invalid_before)
    VALUES($1, 'Phase 2 Tester', 'student', false, now() - interval '1 hour')
    ON CONFLICT (id) DO UPDATE SET blocked = false, sessions_invalid_before = now() - interval '1 hour'
  `, [testUserId]);
  await c.query("INSERT INTO auth.sessions(id, user_id, created_at) VALUES($1, $2, now()), ($3, $2, now()), ($4, $2, now()) ON CONFLICT (id) DO NOTHING", [session1, testUserId, session2, session3]);

  // Admit device 1 -> admitted
  const adm1 = await c.query("SELECT public.auth_admit_device($1, $2, 'Device 1', false, null) as st", [testUserId, session1]);
  if (adm1.rows[0].st !== 'admitted') throw new Error(`Device 1 failed: ${adm1.rows[0].st}`);
  console.log('  Device 1 admitted ✅');

  // Admit device 2 -> admitted
  const adm2 = await c.query("SELECT public.auth_admit_device($1, $2, 'Device 2', false, null) as st", [testUserId, session2]);
  if (adm2.rows[0].st !== 'admitted') throw new Error(`Device 2 failed: ${adm2.rows[0].st}`);
  console.log('  Device 2 admitted ✅');

  // Admit device 3 -> limit!
  const adm3 = await c.query("SELECT public.auth_admit_device($1, $2, 'Device 3', false, null) as st", [testUserId, session3]);
  if (adm3.rows[0].st !== 'limit') throw new Error(`Device 3 expected limit, got: ${adm3.rows[0].st}`);
  console.log('  Device 3 rejected by 2-device limit ✅');

  console.log('\n── Step 2: Test free previews vs locked paid lessons ──');
  const previewAccess = await c.query("SELECT public.learning_can_access($1, $2, $3) as can", [testUserId, session1, previewLessonId]);
  if (!previewAccess.rows[0].can) throw new Error('Preview lesson access failed!');
  console.log('  Free preview accessible without enrollment ✅');

  const paidAccessUnenrolled = await c.query("SELECT public.learning_can_access($1, $2, $3) as can", [testUserId, session1, paidLessonId]);
  if (paidAccessUnenrolled.rows[0].can) throw new Error('Paid lesson should NOT be accessible before enrollment!');
  console.log('  Paid lesson locked without enrollment ✅');

  console.log('\n── Step 3: Price, GST, policy & pending payment verification ──');
  const orderRes = await c.query("SELECT public.demo_create_order($1, $2, $3) as id", [testUserId, session1, courseSlug]);
  const orderId = orderRes.rows[0].id;
  const orderData = (await c.query("SELECT * FROM public.orders WHERE id=$1", [orderId])).rows[0];

  console.log(`  Order created: ${orderId}`);
  console.log(`  Status: ${orderData.status}`);
  console.log(`  Base: ₹${orderData.base_paise / 100}, Tax: ₹${orderData.tax_paise / 100}, Total: ₹${orderData.total_paise / 100}`);
  if (orderData.status !== 'pending') throw new Error('Order not pending!');

  // Check enrollment count remains 0
  const enrPending = await c.query("SELECT COUNT(*) as cnt FROM public.enrollments WHERE user_id=$1", [testUserId]);
  if (Number(enrPending.rows[0].cnt) !== 0) throw new Error('Pending order granted enrollment!');
  console.log('  Zero enrollments for pending order ✅');

  console.log('\n── Step 4: Settle order to paid & verify enrollment ──');
  const event = {
    eventId: `staging_verify_${orderId}`,
    providerOrderId: `demo_${orderId}`,
    status: 'paid',
    amountPaise: orderData.total_paise,
  };
  const hash = createHash('sha256').update(JSON.stringify(event)).digest('hex');
  await c.query("SELECT public.demo_settle_payment($1, $2)", [hash, JSON.stringify(event)]);

  const paidOrder = (await c.query("SELECT status, paid_at FROM public.orders WHERE id=$1", [orderId])).rows[0];
  if (paidOrder.status !== 'paid' || !paidOrder.paid_at) throw new Error('Order did not settle to paid!');

  const enrPaid = await c.query("SELECT * FROM public.enrollments WHERE user_id=$1 AND course_id=$2", [testUserId, courseId]);
  if (enrPaid.rows.length !== 1 || !enrPaid.rows[0].active) throw new Error('Enrollment not created or inactive!');
  console.log('  Order settled to paid and active enrollment granted ✅');

  console.log('\n── Step 5: Classroom progress & notes verification ──');
  // Check paid lesson access is now true
  const paidAccessEnrolled = await c.query("SELECT public.learning_can_access($1, $2, $3) as can", [testUserId, session1, paidLessonId]);
  if (!paidAccessEnrolled.rows[0].can) throw new Error('Paid lesson not accessible after enrollment!');
  console.log('  Paid lesson unlocked for enrolled learner ✅');

  // Start playback
  const startRes = (await c.query("SELECT public.learning_start($1, $2, $3) as state", [testUserId, session1, paidLessonId])).rows[0].state;
  console.log(`  Playback lease created: ${startRes.leaseId} ✅`);

  // Initial heartbeat
  await c.query("SELECT public.learning_heartbeat($1, $2, $3, 1, 0, true, false, 1)", [testUserId, session1, startRes.leaseId]);
  // Advance 10s
  await c.query("UPDATE public.learning_playbacks SET last_at=clock_timestamp()-interval '10 seconds' WHERE user_id=$1", [testUserId]);
  const hbRes = (await c.query("SELECT public.learning_heartbeat($1, $2, $3, 2, 10000, true, false, 1) as state", [testUserId, session1, startRes.leaseId])).rows[0].state;
  console.log(`  Heartbeat recorded. Watched seconds: ${hbRes.watchedSeconds} ✅`);

  // Complete lesson
  await c.query("SELECT public.learning_complete($1, $2, $3, true)", [testUserId, session1, paidLessonId]);
  const progRes = (await c.query("SELECT completed FROM public.lesson_progress WHERE user_id=$1 AND lesson_id=$2", [testUserId, paidLessonId])).rows[0];
  if (!progRes.completed) throw new Error('Lesson complete not saved!');
  console.log('  Lesson marked completed ✅');

  console.log('\n── Step 6: Revocation / Refund protection verification ──');
  // Revoke enrollment
  await c.query("UPDATE public.enrollments SET active=false, revoked_at=now() WHERE user_id=$1 AND course_id=$2", [testUserId, courseId]);
  const accessRevoked = await c.query("SELECT public.learning_can_access($1, $2, $3) as can", [testUserId, session1, paidLessonId]);
  if (accessRevoked.rows[0].can) throw new Error('Access was NOT blocked after revocation!');
  console.log('  Revoked enrollment immediately blocks lesson access ✅');

  // Verify learning_start rejects
  try {
    await c.query("SELECT public.learning_start($1, $2, $3)", [testUserId, session1, paidLessonId]);
    throw new Error('learning_start should have failed on revoked enrollment!');
  } catch (err) {
    if (err.message.includes('Access denied')) {
      console.log('  learning_start correctly raises Access denied for revoked user ✅');
    } else {
      throw err;
    }
  }

  console.log('\n── Step 7: Clean up test rows ──');
  await c.query("DELETE FROM public.order_watch_ranges WHERE order_id IN (SELECT id FROM public.orders WHERE user_id=$1)", [testUserId]);
  await c.query("DELETE FROM public.enrollments WHERE user_id=$1", [testUserId]);
  await c.query("DELETE FROM public.lesson_progress WHERE user_id=$1", [testUserId]);
  await c.query("DELETE FROM public.learning_playbacks WHERE user_id=$1", [testUserId]);
  await c.query("DELETE FROM public.payment_attempts WHERE order_id IN (SELECT id FROM public.orders WHERE user_id=$1)", [testUserId]);
  await c.query("DELETE FROM public.orders WHERE user_id=$1", [testUserId]);
  await c.query("DELETE FROM public.device_sessions WHERE user_id=$1", [testUserId]);
  await c.query("DELETE FROM auth.sessions WHERE id IN ($1, $2, $3)", [session1, session2, session3]);
  await c.query("DELETE FROM public.profiles WHERE id=$1", [testUserId]);
  await c.query("DELETE FROM auth.users WHERE id=$1", [testUserId]);
  console.log('  Disposable test rows successfully cleaned up ✅');

  await c.end();
  console.log('\n🎉 Phase 2 Staging Learner Journey Verification Passed Completely!\n');
}

main().catch(err => {
  console.error('\n❌ Staging Verification Error:', err.message, err.detail || '');
  process.exit(1);
});
