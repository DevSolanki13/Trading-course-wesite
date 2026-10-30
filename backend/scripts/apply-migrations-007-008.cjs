// Apply migrations 007 then 008 to staging. Run from project root.
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();
  console.log('Connected to staging database ✅\n');

  // ── Detailed pre-checks ──────────────────────────────────────────────────

  // Does idempotency_key column exist?
  const col = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='idempotency_key'");
  const hasIdempotencyCol = col.rows.length > 0;
  console.log('[pre] orders.idempotency_key:', hasIdempotencyCol ? 'EXISTS' : 'MISSING — will apply from 007');

  // Does idempotency unique index exist?
  const uidx = await c.query("SELECT indexname FROM pg_indexes WHERE tablename='orders' AND indexname='orders_user_idempotency_idx'");
  const hasIdempotencyIdx = uidx.rows.length > 0;
  console.log('[pre] orders_user_idempotency_idx:', hasIdempotencyIdx ? 'EXISTS' : 'MISSING — will apply from 007');

  // 008 functions?
  const fns = await c.query("SELECT proname FROM pg_proc WHERE proname IN ('demo_create_order','demo_settle_payment')");
  const hasFns = fns.rows.length > 0;
  console.log('[pre] 008 functions:', hasFns ? '⚠️  ALREADY EXIST — cannot re-apply 008' : 'ABSENT — safe to apply 008');

  if (hasFns) {
    console.error('\n❌ Migration 008 functions already exist. Aborting to avoid double-apply.');
    await c.end();
    process.exit(1);
  }

  // ── Apply migration 007 remaining pieces ──────────────────────────────────
  console.log('\n── Applying migration 007 remaining DDL ──');
  
  if (!hasIdempotencyCol) {
    await c.query('ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key text');
    console.log('  ✅ Added idempotency_key column');
  } else {
    console.log('  ⏭  idempotency_key column already present');
  }

  if (!hasIdempotencyIdx) {
    await c.query("CREATE UNIQUE INDEX IF NOT EXISTS orders_user_idempotency_idx ON public.orders(user_id, idempotency_key) WHERE status = 'pending' AND idempotency_key IS NOT NULL");
    console.log('  ✅ Created orders_user_idempotency_idx');
  } else {
    console.log('  ⏭  orders_user_idempotency_idx already present');
  }

  // ── Apply migration 008 ────────────────────────────────────────────────────
  console.log('\n── Applying migration 008 ──');
  const sql008 = fs.readFileSync(
    path.join(__dirname, '../database/migrations/202610300008_payment_hardening.sql'),
    'utf8'
  );
  await c.query(sql008);
  console.log('  ✅ Migration 008 applied');

  // ── Post-migration verification ────────────────────────────────────────────
  console.log('\n── Post-migration verification ──');

  const fnsAfter = await c.query("SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('demo_create_order','demo_settle_payment')");
  console.log('[v1] Functions created:', fnsAfter.rows.map(r => `${r.proname}(secdef=${r.prosecdef})`).join(', '));

  const colAfter = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='idempotency_key'");
  console.log('[v2] idempotency_key column:', colAfter.rows.length > 0 ? 'EXISTS ✅' : 'STILL MISSING ❌');

  const grants = await c.query(`
    SELECT grantee, privilege_type
    FROM information_schema.routine_privileges
    WHERE routine_name IN ('demo_create_order','demo_settle_payment')
    ORDER BY grantee, routine_name
  `);
  console.log('[v3] Function grants:');
  grants.rows.forEach(r => console.log(`   ${r.grantee}: ${r.privilege_type}`));
  const badGrants = grants.rows.filter(r => ['anon','authenticated','public'].includes(r.grantee));
  if (badGrants.length > 0) {
    console.error('❌ UNEXPECTED GRANTS to:', badGrants.map(r=>r.grantee).join(', '));
  } else {
    console.log('   ✅ No grants to anon/authenticated/public');
  }

  // Consistency check: no paid order without matching enrollment
  const mismatch = await c.query(`
    SELECT o.id FROM public.orders o
    LEFT JOIN public.enrollments e ON e.order_id = o.id
    WHERE o.status = 'paid' AND e.id IS NULL
  `);
  console.log('[v4] Paid orders without enrollment:', mismatch.rows.length === 0 ? '0 ✅' : `${mismatch.rows.length} ❌ INCONSISTENT`);

  await c.end();
  console.log('\n✅ All migrations applied and verified.');
}

main().catch(e => { console.error('\n❌ Migration failed:', e.message, '\n', e.detail || ''); process.exit(1); });

