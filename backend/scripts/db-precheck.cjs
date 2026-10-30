// Run from the project root: node scratch/db-check.cjs
const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();
  console.log('Connected to staging database ✅\n');

  // Check 1: migration 007 — idempotency_key column
  const col = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='idempotency_key'");
  console.log('[1] 007 idempotency_key column:', col.rows.length > 0 ? 'EXISTS ✅' : 'MISSING ❌');

  // Check 2: migration 007 — webhook_events provider check includes demo
  const constraint = await c.query("SELECT conname FROM pg_constraint WHERE conname='webhook_events_provider_check'");
  console.log('[2] 007 webhook provider check:', constraint.rows.length > 0 ? 'EXISTS ✅' : 'MISSING ❌');

  // Check 3: 008 functions must NOT exist yet (CREATE not CREATE OR REPLACE)
  const fns = await c.query("SELECT proname FROM pg_proc WHERE proname IN ('demo_create_order','demo_settle_payment')");
  console.log('[3] 008 functions pre-exist:', fns.rows.length === 0 ? 'NONE — safe to apply ✅' : '⚠️  ALREADY EXIST: ' + fns.rows.map(r=>r.proname).join(', '));

  // Check 4: auth_has_session function (required by 008)
  const ahs = await c.query("SELECT proname FROM pg_proc WHERE proname='auth_has_session'");
  console.log('[4] auth_has_session dependency:', ahs.rows.length > 0 ? 'EXISTS ✅' : 'MISSING ❌');

  // Check 5: webhook_events indexes for ON CONFLICT
  const idx = await c.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename='webhook_events'");
  console.log('[5] webhook_events indexes:');
  idx.rows.forEach(r => console.log('   ', r.indexname, '-', r.indexdef));

  // Check 6: RLS on orders + enrollments
  const rls = await c.query("SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('orders','enrollments') ORDER BY tablename, policyname");
  console.log('[6] RLS policies:', rls.rows.length === 0 ? '(none found)' : '');
  rls.rows.forEach(r => console.log('   ', r.tablename, '/', r.policyname, '/', r.cmd));

  // Check 7: current orders snapshot (safety)
  const orders = await c.query("SELECT status, COUNT(*) as cnt FROM public.orders GROUP BY status");
  console.log('[7] Existing orders by status:', orders.rows.length === 0 ? '(none)' : JSON.stringify(orders.rows));

  // Check 8: enrollments snapshot
  const enr = await c.query("SELECT COUNT(*) as cnt FROM public.enrollments");
  console.log('[8] Existing enrollments:', enr.rows[0].cnt);

  await c.end();
  console.log('\n✅ Pre-migration checks complete.');
}

main().catch(e => { console.error('❌ Check failed:', e.message); process.exit(1); });

