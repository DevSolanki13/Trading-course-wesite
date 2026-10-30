const { Client } = require('pg');
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  
  // Get exact constraint definition
  const r = await c.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint 
    WHERE conname='webhook_events_provider_check'
  `);
  console.log('Constraint def:', JSON.stringify(r.rows));
  
  // Check what providers are in existing webhook_events
  const r2 = await c.query("SELECT DISTINCT provider FROM public.webhook_events LIMIT 20");
  console.log('Existing providers:', JSON.stringify(r2.rows));
  
  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
