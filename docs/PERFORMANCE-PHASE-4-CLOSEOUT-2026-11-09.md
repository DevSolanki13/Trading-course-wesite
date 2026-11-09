# Phase 4: remaining implementation and rollout gates

Date: 9 November 2026

Status: remaining application/database-read implementation integrated and local automated checks passed. Hosted rollout and browser/provider acceptance remain pending. No browser tests, hosted migrations, scheduler activation or deployment performed.

## Changes and benefits

| Task        | Implementation                                                                                                          | Benefit / preserved behavior                                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P4.2        | Select the published course before constructing curriculum/progress JSON                                                | Avoid building every course just to return one. Existing catalogue, expiry, ownership, preview and progress values are preserved.                                                                             |
| P4.3        | Combined-provider keyset history pages, global counts/amounts, server filters and independent bounded pending discovery | Load a bounded page, keep every historical order reachable, retain receipt routes, and continue reconciling pending orders outside the visible page.                                                          |
| P4.4        | One guarded refund-page RPC with page-scoped evidence                                                                   | Replace one list request plus up to 50 evidence requests with one remote operation. Reuse the unchanged immutable-snapshot evidence calculation; refund mutations still perform current transactional checks. |
| P4.6        | Staff learner summary pages and selected-learner lesson details                                                         | Avoid returning every learner's full lesson history. Preserve totals, search, progress, access filters and admin/support admission. Local-demo eligibility remains unchanged.                                 |
| P4.7        | Next-tracked post-response receipt attempts, existing durable outbox and minute staging-worker scheduler example        | Confirmed payment no longer waits for email transport. Leases, retries, deduplication and recipient ownership remain authoritative. External scheduler must still be activated separately.                    |
| P4.1/P4.9   | Isolated query plans, payload/count evidence and existing-index inspection                                              | Justify local read changes without inventing hosted latency or deploying speculative infrastructure changes.                                                                                                  |
| P4.10/P4.11 | Additive migration contracts, isolated migrated tests, API/UI regression coverage and rollback notes                    | Keep old APIs available during staged rollout and test financial/access invariants before deployment.                                                                                                         |

First-batch lesson/gateway improvements remain in place. See [first-batch results](./PERFORMANCE-PHASE-4-RESULTS-2026-11-09.md), [history evidence](./PERFORMANCE-PHASE-4-HISTORY.md), [learner evidence](./PERFORMANCE-PHASE-4-LEARNERS.md), and [receipt evidence and scheduler setup](./PERFORMANCE-PHASE-4-RECEIPTS.md).

## Scoped-read evidence

The fresh migrated fixture contains 100 courses, 300 lessons and 55 refund requests. Anonymous, owner and unrelated-user course results match the previous catalogue-based read; missing/draft courses remain absent, and expired/blocked access semantics remain identical. Both staff roles receive equivalent refund pages, including an empty filtered/final page; students and revoked sessions are denied. Each returned refund evidence object matches the existing function, including after watched content changes.

A focused run observed legacy/scoped course-query medians of 12.12/0.99 ms and sample p95 values of 13.23/2.09 ms across seven samples each. The selected payload was 628 bytes in both cases. These small, warm, isolated PGlite observations are not production latency, a statistical SLA, or a website-wide speedup. Full-suite concurrency changes these numbers substantially. `EXPLAIN` for the SQL function shows an outer result node, not every nested statement; the separate history fixture records its actual cursor-scan plan.

No security check, financial snapshot, payment settlement rule, refund mutation, branding asset or existing animation was removed. The historical expiry-backfill test now defers the dependent Phase 4 read APIs until after the expiry-column backfill; it still tests legacy rows before and after that backfill.

## Local verification

- `npm run test:unit -- --maxWorkers=4`: **266 passed, 40 files, zero failures**, rerun after the review fix.
- `node --test --test-concurrency=4 --experimental-strip-types tests/*.test.ts tests/*.test.mjs`: **79 passed, zero failures**. Combined total: **345 passing tests**. Backend/SQL code did not change after this run.
- `npm run typecheck` and `npm run lint`: passed.
- Production build (existing Build application task): passed, including the dedicated learner route. The pre-existing announcement `.local-data` tracing warning remains; it is not a Phase 4 fix or a silently resolved warning.
- Focused scoped-course/refund tests, editor diagnostics and whitespace checks passed.

Browser testing is intentionally excluded at the user's request. A first full run captured an in-progress learner retry failure and a historical migration-order fixture dependency. The retry passed with the correct detail-effect dependency in the integrated code; the backfill fixture now defers dependent read APIs. Both passed the final full runs rather than being relabelled as pre-existing failures.

The independent read-only reviewer found one concrete stale-snapshot bug in the billing hook: replacement server rows could retain old totals/cursors. The dashboard is keyed by user ID, so the reviewer explicitly corrected the initial cross-account interpretation; the confirmed issue was fresh server data for the same user/route. A new regression test failed before the fix. The hook now resets rows, metadata, cursors, filters and errors together when either server snapshot source changes, consumes the replacement seed once and ignores the old reply. The three-file billing/history/account-switch set passed 28 tests, followed by the final 266-test UI suite, lint, TypeScript and a successful rebuilt application. The reviewer found no additional concrete SQL authorization or outbox-claim regression in the reviewed paths; hosted behavior was not inspected.

## Migration and compatibility rollout

This project uses its existing checksum-based migration runner, not a newly installed Supabase CLI. Original applied migrations are not edited. The three new migration files are:

1. [Scoped course/refund reads](../backend/database/migrations/202611090041_phase4_scoped_reads.sql).
2. [Learner pages](../backend/database/migrations/202611090042_phase4_learner_pages.sql).
3. [Combined history](../backend/database/migrations/202611090043_purchase_history_page.sql).

Prepare/apply them in filename order **before** deploying the matching application. The existing staging-only runner checks its linked target, requires explicit `--apply`, serializes migration execution and applies pending migrations transactionally. No command against a shared target was run during this task. Review index build locking and expected data volume before applying; use a separate reviewed concurrent-index rollout if a large live table warrants it rather than copying transactional DDL blindly.

Existing catalogue, single-order/UPI decoration, settlement and refund-mutation interfaces remain available. Old full-history and learner RPCs remain compatibility paths; active dashboards/panels use the new bounded APIs. Legacy history remains a private, admitted endpoint and is not evidence that the active UI still loads full history.

Rollback order: roll the application back first, leaving additive read functions/indexes in place. This does not rewrite orders, receipts or enrollments. If schema cleanup is separately approved, use a new compensating migration: restore the `purchase_read` wrapper from the pre-Phase-4 gateway-URI migration before removing its new course helper, and remove only new APIs/indexes after verifying no deployed caller uses them. Do not edit applied migration checksums or reverse unrelated migrations. Fresh-database tests verify forward application and old API compatibility; hosted rollback execution has not occurred.

## Remaining external gates — not additional local feature work

- [ ] Verify target database migrations/indexes and representative query plans with approved read-only access; compare request payloads and median/p95 timings using representative data.
- [ ] Verify hosting function and database region alignment in the actual deployment. No region was inferred from a project URL and no hosting setting was changed.
- [ ] Install/enable the minute scheduler in an allowed staging environment, with the existing worker authentication, operations policy, sender configuration and delivery opt-in. Test interrupted sends/retries and actual email arrival. The retained daily Vercel cron is **not** the prompt retry solution.
- [ ] Apply reviewed migrations, deploy, and verify hosted API/PostgREST compatibility in the authorized target.
- [ ] Complete the manual browser/provider checks below. These are acceptance gates, not claims of missing local implementation.

The worker deliberately rejects production under the existing operations policy. Do not bypass that guard or silently assume a paid hosting plan. A production worker/scheduler rollout requires a separate approved release decision. Next `after` requires a supported server runtime and does not itself replace durable retry scheduling.

## Browser checks for the user

1. Open Billing with more than one page of mixed-provider history. Use Next/Previous and status/provider filters. Verify every order remains reachable, counts/amounts are global and receipts still open for the correct owner.
2. Leave a test pending order outside the visible history page. Return from the payment app/sandbox, refresh and hide/resume the tab. Verify authoritative paid state and receipt availability; check unsupported-provider/UPI freshness. Do not make a live charge just for this test.
3. In a staff account, page/search/filter course learners; open lesson details, rapidly switch learners/courses and retry an error. Compare progress/counts and confirm support retains permitted access while a student is denied.
4. Page/filter refunds and compare saved amounts, evidence and current eligibility. Do not submit a real refund solely to test this optimization.
5. Open a published course by slug and ID as anonymous, enrolled and expired test users. Verify curriculum, preview, access, progress and private assets remain correct.
6. In an authorized sender/sandbox environment, hold or fail email transport. Confirm payment status returns without waiting, only one receipt is accepted, and the activated worker eventually retries through the existing outbox. Check both themes and unchanged animations during these flows.

## Skills and scope

Gravitas/Karpathy guidance kept work split into scoped batches with explicit invariants and executable checks. Supabase/Postgres guidance informed service-only grants, unchanged server admission, isolated query plans and additive migration testing. React guidance focused the UI review on bounded payloads, stale-response handling and lifecycle correctness; installed Next.js route/`after` docs informed server integration. An independent read-only review was requested for the cross-cutting financial/access changes.

No dependency upgrade, provider switch, shared-data mutation, browser test, external scheduler installation, production deployment or commit/push is included in this implementation turn.

The verdict below covers only the completed local implementation/automated verification scope. The unchecked external gates above remain outside that scope.

VERDICT: PASS
