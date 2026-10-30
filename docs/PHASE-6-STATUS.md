# Phase 6: verification, deployment and handover

Updated 31 October 2026 (IST). **Local release verification delivered; hosted acceptance and live sales remain blocked.** This is the current evidence record for [the implementation plan](../IMPLEMENTATION-PLAN.md), [priority work](./PRIORITY-WORK-2026-10-30.md) and [important work](../IMPwork.md).

## Delivered and verified

**Commerce follow-up:** [Phase 3](./PHASE-3-STATUS.md) now records the completed local sandbox payment/refund/billing/email/scheduler implementation. New regression totals are 35 Node tests and 10 React tests; the expanded 32-test browser suite passes, and both bundled billing fonts are present in the production route trace. Migration 009 is unapplied to shared staging. The Lighthouse results below belong to the earlier Phase 6 baseline and were not remeasured for this follow-up.

| Check                                      | Result                        | Scope and evidence                                                                                                                                                                                                                               |
| ------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ESLint and strict TypeScript               | PASS                          | `npm run check`; the original 11 lint errors and three warnings are resolved                                                                                                                                                                     |
| Database, payment, access and policy tests | PASS, 35 tests                | Disposable PGlite databases; no shared database writes. Includes duplicate/terminal payment safety, rollback, role boundaries, exact refund limits, device limits and notification lease ownership                                               |
| React tests                                | PASS, 10 tests                | Catalogue filtering and payment confirmation: bounded pending polling, no second payment while waiting, retry after failure, terminal states and cancellation on unmount. These mock HTTP responses and do not prove Cashfree settlement         |
| Production build                           | PASS                          | Next.js 16.4.3; the installed framework documentation was consulted before changes                                                                                                                                                               |
| Formatting                                 | PASS                          | Repository-wide Prettier check; existing formatting debt was corrected. Lockfiles are excluded from formatting                                                                                                                                   |
| Production browser suite                   | PASS, 32 tests                | Chromium desktop 1440×900/mobile 390×844, dark/light; 48 public route/theme checks, 16 Axe WCAG A/AA audits, search, native form validation, keyboard focus/trapping/restoration, navigation and reduced motion                                  |
| Browser security checks                    | PASS within the same 32 tests | Different CSP nonce per response; no production `unsafe-eval`; private/no-store responses; blocked anonymous APIs and cross-origin login; disabled checkout/demo endpoints; staging no-index; metadata, PNG social image and public-only sitemap |
| Missing-page HTTP status                   | PASS                          | Unknown public page and course return HTTP 404. The previous root loading boundary streamed a 200 before `notFound()` could decide. Loading skeletons now belong to the private learning/admin route segments                                    |
| Mobile performance                         | PASS                          | Lighthouse 13.6.0: performance **100**, accessibility **100**, LCP **1064 ms**, CLS **0.0039**, TBT **64 ms**, transfer **312,936 bytes**                                                                                                        |
| Dependency audit during installation       | PASS                          | npm reported zero known vulnerabilities when Lighthouse was installed                                                                                                                                                                            |

The browser/performance server uses synthetic credentials and the illustrative catalogue, on dedicated loopback ports. It does not call the shared database or payment/video/email providers. API 503 logs for fixture-only course lookups are expected; browser runtime errors and Axe violations are asserted separately. The responsive screenshots were inspected for desktop dark and mobile light.

Performance was measured on the local production build with simulated mobile 4G: 150 ms RTT, 1638.4 Kbit/s throughput, 4× CPU slowdown and a 412×823 viewport. It is a laboratory result for this catalogue and machine. Hosted latency, real course content, field INP, sustained traffic and physical-device DRM are not established by this result. See [Lighthouse's throttling guidance](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md).

Generated evidence is ignored by Git:

- `artifacts/phase-6/playwright.json` and `artifacts/phase-6/playwright/index.html`.
- `artifacts/phase-6/test-results/`: per-project screenshots and any failure traces.
- `artifacts/phase-6/lighthouse.report.html`, `.report.json`, and `lighthouse-summary.json`.
- `artifacts/phase-6/operations.json`: read-only operational result, including failures.

Only the synthetic browser evidence is uploaded by CI. Never upload other operator artifacts, which may contain provider credentials or account state.

## Priority and important work advanced after verification

1. **Learner journey:** added regression coverage for the payment-status recovery flow. Pending confirmation never offers learning access or a second checkout; a successful status response exposes the course link; failed/cancelled/refunded states stop polling. Payment authorization remains server-owned.
2. **Security:** retired the ad-hoc schema/constraint mutation shortcuts. Old verification entry points now invoke the supported read-only verifier, rather than creating fixed-ID accounts or persistent published test courses. These wrappers intentionally no longer perform the old mutation tests; the disposable local tests cover those scenarios.
3. **Database safety:** all supported operator connections enforce matching staging project, session-pooler port and certificate/hostname verification. A trusted project CA can be set with `DATABASE_CA_CERT_PATH`, URL `sslrootcert`, or `NODE_EXTRA_CA_CERTS`. Insecure TLS modes are rejected.
4. **Durable email retries:** completion now compares the claim attempt and requires a live lease. A delayed worker cannot mark a newer worker's claim sent/failed. A PostgreSQL test proves stale/expired rejection, backoff and idempotent completion. No student email was sent by this work.
5. **Monitoring preparation:** `npm run ops:check` reads migration checksums, invalid entitlements/totals, paid orders without enrollment, exhausted/expired notification claims, failed/old webhook events, stalled refunds and obvious published test courses. It returns nonzero for blockers and prints counts rather than customer data. It is not yet a scheduled alert service.
6. **Accessibility:** adjusted the shared light-theme gold token to readable brown-gold; no landing redesign was performed. The design detector still flags existing theme-document drift and a header height transition; these are recorded design debt, not new feature changes.

## External and implementation gates still open

| Gate                  | Fresh evidence / next action                                                                                                                                                                                                                                                                                                                       | Owner                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Staging schema/ledger | Initial read-only recheck connected but failed `MIGRATION_LEDGER_MISMATCH`. After enforcing certificate verification, the connection fails `SELF_SIGNED_CERT_IN_CHAIN`. Obtain the trusted project CA, rerun both `db:verify` and `ops:check`, then compare applied schema/functions with the ledger. Do not replay migrations or invent checksums | Developer + database owner          |
| Hosted preview        | Local link names `trading-course-website-staging`. Vercel connector returned 404 by both name and saved project ID in the saved team. CLI fallback had no credentials; its login flow was cancelled. No deployment was created and no different account/project was substituted                                                                    | Hosting owner + developer           |
| Real commerce         | Sandbox checkout/API-confirmed settlement, reconciliation, full refunds, private PDF/HTML billing and email/scheduler code are now locally implemented. Migration 009, actual merchant/inbox acceptance, approved tax inputs and production enablement remain open; see Phase 3                                                                    | Developer + business owner          |
| Real content          | Two approved courses, prices/durations, processed video mappings, instructor identity, support/business/tax information and approved policies are still required. Remove existing disposable staging courses through the authorised Admin workflow                                                                                                 | Instructor + business owner         |
| DRM                   | Token issuance is implemented; actual protected playback, watermark, domain whitelist, access revocation and capture behavior need Windows/Android/iPhone acceptance                                                                                                                                                                               | Instructor + device tester          |
| Auth/email            | Finish real Google consent/callback and general-recipient verification/reset flows with a verified business sender. API email acceptance is not inbox-delivery proof                                                                                                                                                                               | Business owner + developer          |
| Operations            | Backups, isolated restore drill, WAF/rate-limit configuration, alert destinations, email-worker scheduling and settlement reconciliation are not configured/accepted by this session                                                                                                                                                               | Hosting/database owners + developer |
| Capacity              | No 200-session hosted load test or provider checkout burst was run. Agree the target, provider limits and isolated dataset first                                                                                                                                                                                                                   | Owner + developer                   |
| Domain                | Final brand and domain purchase/DNS remain pending. Prior availability and prices are historical observations, not a reservation                                                                                                                                                                                                                   | Business owner                      |

Earlier reports of migration 008 being applied are retained as history, **not fresh schema acceptance**. This session did not alter the shared database, reconcile a ledger, publish content, purchase a domain, send email or charge/refund anyone.

## Reproduce and next sequence

```powershell
npx playwright install chromium
npm run verify:release
npm run format:check
npm run test:performance
# Read-only, requires the staging project and trusted database CA:
npm run db:verify
npm run ops:check
```

`verify:release` builds before starting the isolated browser suite. Performance and browser checks use ports 3101 and 3100 respectively and refuse to reuse an existing server. Keep a build available before running either command separately.

Follow [the operational runbook](./OPERATIONS-RUNBOOK.md) for administrator onboarding, deployment isolation, migration drift, monitoring, email failures and restore acceptance. Continue in this order: trusted staging connection/ledger → accessible staging deployment → real Cashfree implementation and sandbox journey → approved courses/video mappings → physical-device/email acceptance → production/domain/restore/live purchase gates. The landing redesign remains deferred.
