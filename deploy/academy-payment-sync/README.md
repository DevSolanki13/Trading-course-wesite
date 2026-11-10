# Academy UPI admin mirror

This is a separate Academy job, not an IndianXtrade gateway change. It reads
existing gateway tables in a read-only transaction and updates only Academy's
admin display tables. It never changes deposits, credits, balances, orders or
course access. Only Academy's dedicated collector UPI deposits are exported;
unconsumed credits are limited to the approved collection VPAs, including gateway bank
alerts that list multiple possible VPAs. No trading-user information or USDT
records are exported.

1. Apply `202611080026_admin_upi_payments.sql` and
   `202611080027_upi_snapshot_safe_updates.sql` in Academy.
2. Generate a 48-byte random sync secret; save only its SHA-256 hash in
   `academy_upi_sync(id,secret_hash)`. Keep the original in a private JSON file
   owned by the job operator with permission 600. It grants only snapshot
   ingestion; it cannot settle a purchase or read any payment tables.
3. Install `backend/scripts/sync-academy-upi.py` beside the gateway database.
   It requires Python 3 and access to `docker exec`, with no added packages.
4. Configure private JSON keys: `container`, `database`, `collector`, `vpas`,
   `supabaseUrl`, `publishableKey`, `syncSecret`. Use Academy's public Supabase
   key, never its service-role key or a gateway administrator cookie. `vpas` is
   an array of the same approved receiving UPI IDs configured in IndianXtrade's
   and Academy's `UPI_COLLECTION_VPAS`. The old `vpa` string remains a fallback
   when `vpas` is absent. Invalid or empty arrays fail before querying or publishing.
5. Run once with `--config /private/path/config.json --dry-run`, then without
   `--dry-run`. Schedule every minute using cron and `--config`.

The whole snapshot commits atomically. Failed, incomplete or older snapshots
cannot clear newer rows. Consumed credits disappear on the next successful sync;
resolved deposit states replace the old states. The UI shows its last successful
sync and warns after three minutes. A refresh reads the latest saved snapshot;
it does not force a bank poll. No new Vercel environment variables are required.

Academy admin: `/admin?view=payments`. Needs review and History contain only
Academy UPI course orders bound to their own gateway checkouts (plus historical
Academy UPI orders). Unmatched credits are explicitly shared-account records,
not presumed Academy revenue. Find Academy orders searches the exact amount;
amount alone is never evidence of payment. Check payment uses the existing
owner-authenticated gateway status and purchase settlement transaction. There
is no manual approve button or secondary credit matcher. Rejected/expired
checkouts can be closed only after verification against the gateway.

On failure, check cron and connectivity, then run the job manually. Its output
contains counts or an error class only. Never print the private config file or
raw provider/database errors into logs. Rotate the sync secret by changing the
stored hash and private config together.
