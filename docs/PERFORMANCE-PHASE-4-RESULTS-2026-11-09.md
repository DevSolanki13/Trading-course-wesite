# Phase 4: first implementation batch

Date: 9 November 2026

Status: **First batch implemented and verified locally. Phase 4 overall is IN PROGRESS, not complete.** Phase 3's existing uncommitted changes were preserved. Browser tests remain delegated to the user.

Full Phase 4 estimate at the start: approximately **4–8 hours for local implementation/verification**, dependent on database findings. Hosted rollout, required external coordination and browser/provider acceptance are additional gates, not a guaranteed deadline.

## Completed in this batch

| Task          | Before                                                                                                                            | Implemented / benefit                                                                                                                                                                                                                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P4.3, partial | Legacy history finished before current-provider history started                                                                   | Start both independently with `Promise.all`. A test holds the legacy response and confirms the current read starts anyway. Preserve all historical records, amounts, receipt routing and provider separation. Equal timestamps now have a deterministic descending-ID tie-break. **Pagination is not implemented yet.**                                     |
| P4.5          | Lesson/module/course metadata required three sequential reads; authorization loaded account-wide enrollments, orders and progress | One joined metadata read, followed by owner-and-course-scoped evidence. Lesson authorization skips the unused account-wide progress RPC. Full library/course views retain their original progress reads. Fewer round trips and smaller evidence payloads, without removing enrollment/expiry checks.                                                        |
| P4.8          | A new gateway adapter could repeat collector login/refresh and concurrent requests could each log in                              | Share a bounded collector-session entry within a warm process, keyed by transport and a SHA-256 fingerprint of origin, gateway mode, collector email/password, supplied session and collection VPA. Coordinate in-flight login, respect cookie expiry with a conservative five-minute cap, and retry authentication only once per unauthorized API request. |
| P4.8 safety   | A delayed unauthorized reply could trigger another login despite a newer session                                                  | An old-cookie `401` does not discard a newer session. Repeated rejection invalidates only the matching cookie; failed login is retryable. Configuration rotation, disabled configuration and distinct collectors/transports do not reuse another entry. Cache is bounded to eight configurations per transport.                                             |
| P4.1, partial | No batch-specific lesson metadata plan fixture                                                                                    | Added a fully migrated in-memory Postgres fixture with 100 courses, 100 modules and 1000 lessons. Captured read-only query-plan evidence and inspected 16 existing relevant indexes. No production indexes were inferred or changed.                                                                                                                        |

Application changes: [history repository](../backend/purchase/repository.ts), [learning evidence/access](../backend/learning/data.ts), [learning handlers](../backend/handlers/learning.ts), [gateway adapter](../backend/payments/indianxtrade.ts).

## Preserved boundaries

- Owner identity comes from the existing server admission check. Scope comes from the published lesson's joined course, not a browser-supplied ownership claim.
- Missing/unpublished/inconsistent lesson metadata fails closed. Anonymous previews remain allowed; protected lessons still require current, active, non-revoked purchase access and a paid order owned by the verified user.
- Metadata lookup now precedes the scoped account load; invalid/unpublished lessons can return 404 before identity checks. Valid lesson requests still perform admission. Notes/resources are never disclosed before access checks.
- Playback leases, progress writes, duration checks, watermark behavior, post-provider access rechecks and token disclosure guards remain in place. Local-demo route behavior is unchanged.
- Collector cookies are server-only service-account credentials, **not learner identity**. No user authorization, payment status or ownership is globally cached. Gateway amount/VPA/QR checks, origin/redirect restrictions and timeouts remain unchanged.
- Collector reuse is per warm process/transport, not distributed across hosting instances. Remote gateway authorization remains authoritative; the cache is not a payment-verification shortcut.
- Both order reads remain owner scoped. An error in either source rejects the combined read rather than returning a misleading partial history.
- No animation, frontend component, payment settlement, receipt transport, financial snapshot or refund rule was changed in this batch. No real payment or collector-login request was made during testing.

## Executed verification

- Before-batch baseline from Phase 3: **193 component/API tests and 62 backend/asset tests passed**.
- After-batch `npm run test:unit`: **209 passed, 33 files, zero failures**.
- After-batch `npm test`: **71 passed, zero failures**. Total: **280 passing tests**.
- Production build, ESLint, TypeScript and whitespace checks: **passed**. The pre-existing announcement `.local-data` file-tracing warning remains unrelated and unresolved.
- Gateway tests cover shared concurrent login, reuse by new adapter instances, delayed-old-cookie 401s, collector/password/session/VPA/mode isolation, short expiry and five-minute cap, failed-login retry, bounded repeated-401 handling, expired-cookie rejection, transport separation and cache bounds.
- Lesson tests cover one metadata read, verified scope, unchanged full-library progress, anonymous preview, sign-in/ownership, expired/revoked/inactive/unpaid access, metadata failures and admission/device errors.
- Order tests prove the independent read starts before the other resolves, plus deterministic tie sorting and unchanged financial values. Existing billing, receipt, duplicate settlement, refund/auth/device/UPI regression checks remain green.
- Isolated `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` returned one selected lesson. Existing `lessons_pkey` and `courses_pkey` were used; the planner also chose a small-table scan/hash join. Observed execution was 0.269 ms in the focused run and 0.616 ms during the full suite. These are **PGlite fixture observations, not hosted latency or a promised improvement**. The equivalent SQL join verifies relationships/planning; a live PostgREST request still needs target-environment acceptance.

Source-level lesson-read count, excluding unchanged admission and later asset/provider/lease checks: metadata **3 → 1**; enrollment/order/progress evidence **3 → 2**, scoped to the selected course. Five mocked adapter instances shared **one** collector login. These are bounded implementation/test observations; no whole-site speedup or production query plan is claimed.

## Still remaining in Phase 4

- [ ] **P4.1:** Representative order/refund/learner query distributions, payloads and latency measurements; inspect the actual approved target's deployed indexes.
- [ ] **P4.2:** Scoped course SQL without constructing the full personalized catalogue.
- [ ] **P4.3:** Stable pagination across the combined history, preserving total/count semantics, all receipts and pending-payment discovery. Parallel reads alone do not complete this task.
- [ ] **P4.4:** Page-scoped batch refund evidence plus equivalent eligibility and transactional action checks.
- [ ] **P4.6:** Paginated learner summaries and selected-learner lesson details without dropping totals/filters or support access.
- [ ] **P4.7:** Separate confirmation from email transport using the durable outbox and a prompt, retryable worker trigger. The current daily schedule is not enough; no untracked fire-and-forget substitute was introduced.
- [ ] **P4.9:** More query-plan/index and hosting/database-region checks. Add indexes only with evidence.
- [ ] **P4.10:** Prepare/test any required additive/versioned migrations with rollback and API compatibility. No migration file or shared database change was made in this first batch.
- [ ] **P4.11:** Broader pagination/refund/receipt-worker/failure regression coverage as those changes are implemented; target-environment and manual browser/provider acceptance for this batch.

P4.5 and P4.8 code/local verification are finished for this batch, but their hosted/browser/provider acceptance remains pending. The parent plan deliberately leaves overall Phase 4 acceptance open.

## Browser/provider checks for you

1. Verify mixed-provider billing history still contains every order, unchanged totals/statuses and working receipts. Check equal-date records stay consistently ordered after reload.
2. Check public preview, paid lesson notes/resources/playback and resume behavior. With test accounts, verify wrong-owner, expired/revoked enrollment, unpublished lesson/course and device-limit cases still deny access. Test an enrollment revoked while video credentials are being prepared.
3. In an authorized sandbox/provider environment only, observe collector login counts across repeated status checks, expiration and concurrent checks. Confirm recovery from one `401`, bounded failure after repeated `401`s, and continued rejection of mismatched amount/VPA/QR data. Do not initiate a live charge just to test performance.
4. Compare like-for-like request counts/payloads/timing against the baseline, distinguishing warm/cold processes and local versus hosted behavior. Retain Phase 2/3 browser checklists for their separate pending acceptance.

## Scope and continuation

Policy: deep, dependency-grounded implementation; first-batch scope limited to the four backend files, tests and documentation; no browser tools, hosted mutation, deployment or commit/push. No new dependency or migration tooling was installed.

The repository-safety skill kept this batch separate from pending Phase 3 changes. Supabase guidance informed current relationship-query behavior, and the Postgres skill required an isolated query plan before proposing indexes. No index was added without evidence. The next implementation batch should handle versioned/scoped database APIs and pagination; financial batching and receipt-worker work remain separately testable batches.

VERDICT: PASS

This verdict covers the executed first-batch local validators, not completion of Phase 4 or hosted/browser/provider acceptance.
