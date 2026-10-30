// Fix the webhook_events_provider_check constraint and re-run all verification
const { Client } = require('pg');
const { createHash } = require('crypto');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log('Connected ✅\n');

  // Fix the constraint — drop old cashfree-only version and add corrected one
  console.log('── Fixing webhook_events_provider_check constraint ──');
  await c.query("ALTER TABLE public.webhook_events DROP CONSTRAINT IF EXISTS webhook_events_provider_check");
  await c.query("ALTER TABLE public.webhook_events ADD CONSTRAINT webhook_events_provider_check CHECK (provider IN ('cashfree','demo'))");
  
  // Verify
  const r = await c.query("SELECT pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conname='webhook_events_provider_check'");
  console.log('  Updated constraint:', r.rows[0].def, '✅\n');

  await c.end();
  console.log('Constraint fix complete.');
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });

