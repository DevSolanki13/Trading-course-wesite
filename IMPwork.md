# Important work: completed and remaining

Updated: 31 October 2026 (IST).

**Current status:** the local course purchase and learning flow is implemented. The remote homepage redesign is merged locally, with subsequent card spacing, padding and graph adjustments. You can test it without payment approval, external accounts or environment variables. Live sales still require the setup and acceptance checks listed below. Local implementation passing does not mean the shared staging database or production deployment has been accepted.

Details: [purchase/access implementation and file inventory](./docs/PURCHASE-ACCESS-STATUS.md), [README setup and testing](./README.md#run-locally-with-zero-environment-setup), [original priority work](./docs/PRIORITY-WORK-2026-10-30.md), [Phase 6 status](./docs/PHASE-6-STATUS.md) and [operations runbook](./docs/OPERATIONS-RUNBOOK.md).

## Completed

### Course purchase and learning

- [x] Payment provider interface with `createOrder`, `verifyPayment` and `handleWebhook`; mock and Razorpay implementations with configuration-based selection.
- [x] Zero-env mock checkout with a visible test banner, order summary, approximately 1.5-second processing, success, failure, cancellation and retry states.
- [x] Production refuses checkout when real keys are missing, unless mock payments are explicitly allowed. Mock endpoints return 404 when unavailable or when the real provider is active.
- [x] Server-owned prices/totals, payment ownership checks, server-side Razorpay signature and captured-payment verification, idempotent events and atomic paid access creation.
- [x] Login/signup returns to checkout; already purchased courses show Go to course.
- [x] Payment confirmation, dashboard, saved progress, continue learning, purchase history and private printable receipts.
- [x] Protected course player with modules, lessons, free previews, next/previous navigation and completion tracking. Existing production VdoCipher playback is preserved; sample native videos are for the local demo.
- [x] Confirmation email abstraction with development console fallback and existing Resend/outbox integration. Delivery failure does not remove paid access.
- [x] Responsive light/dark pages, loading/empty/error states and themed toasts using the existing design system.

### Local accounts, data and security

- [x] Isolated PostgreSQL-compatible PGlite storage using the existing SQL migrations; production Supabase is retained.
- [x] Three sample courses with modules and lessons; repeatable `npm run db:seed` preserves purchases and progress.
- [x] Bcrypt-hashed student and administrator demo accounts, initially without purchases; development-only dismissible login hint and credential-fill button.
- [x] Private opaque sessions, login rate limiting, input validation, same-origin checks and rejection of client-supplied roles/amounts.
- [x] Unique purchase access, duplicate-safe settlement, rollback on failed enrollment, private lesson content and completion timestamps in migration 010.
- [x] Production safeguards prevent automatic local database fallback and accidental demo-user seeding. Demo administrators do not bypass production staff MFA.
- [x] Existing security controls retained: nonce CSP, configured HTTPS HSTS, entitlement/device checks, short-lived DRM tokens, domain restrictions and moving viewer watermark.

### Earlier commerce and documentation

- [x] Cashfree sandbox adapter, reconciliation, approved full-refund recovery, private PDF/HTML billing documents and credit notes implemented and locally tested. Cashfree remains an explicit legacy mode; Razorpay is the real provider for the newly requested flow.
- [x] Durable email jobs, protected scheduler and aggregate monitoring code implemented. Hosted scheduling, sending and alerts still need configuration and acceptance.
- [x] Environment template, local startup, purchase testing instructions, production checklist and detailed change inventory documented.
- [x] Earlier homepage revert superseded by the authorized remote homepage merge; see the current homepage section below.
- [x] Video hosting options and provisional domain choices recorded in the original priority report. Those historical availability/pricing observations are not reservations or current quotes.

## Current homepage and Git integration

- [x] Merged remote `origin/main` at `e749708` into `feat/zero-env-purchase-access`; merge commit `0a00936`. Accepted the remote versions of [homepage](./frontend/pages/home-page.tsx) and [landing styles](./frontend/styles/landing.css) for the two conflicts.
- [x] Retained the five local feature/baseline commits, including the Supabase classroom compatibility fix. Restored and checked all six pre-merge modified/new files against the stash backup. Backup stashes remain available.
- [x] Remote homepage includes the market ticker, scrolling sample-market cards, statistics grid, course collection, risk exercise, testimonials, FAQ and closing call to action.
- [x] Increased scrolling-card heights from 160px to 190px on desktop and 150px to 180px on mobile; increased gaps from 16px to 24px.
- [x] Replaced fixed statistics row heights with flexible minimums of 280px and 230px. Added 32px card padding, wrapping for learner avatars/details, and a single-column layout at widths of 540px and below with 28px padding.
- [x] Increased the curriculum bar-chart height from 120px to 180px, with 212px of reserved bottom space to separate the chart from text.
- [x] Consolidated completed and remaining work into this tracker and removed the duplicate work log.
- [ ] Inspect the latest spacing and graph changes in a browser on desktop and mobile, including longer text and zoom. CSS diagnostics and diff checks passed; these do not establish visual acceptance.
- [ ] Approve or replace hardcoded homepage ratings, student counts, testimonials, curriculum statistics and broker/trust names before public launch. The merged page contains these claims; their accuracy and permission are not established.
- [ ] Review the merged hero copy against administrator content editing: the new hero text is hardcoded, while FAQ content still supports configured entries.
- [ ] Run a fresh production build and browser regression/accessibility tests against the merged homepage and latest CSS. Earlier build/browser results below predate these changes.
- [x] Committed the local work separately by purpose: `ac0f38c` (demo/editor setup), `1254aee` (homepage spacing and graph), `095f9f4` (shared website theme), and `f2d86d9` (course expiry, renewal and tests). The consolidated tracker/setup/report updates are recorded in a separate documentation commit.
- [x] Pushed the feature branch `feat/zero-env-purchase-access` to GitHub. Main remains unchanged; release checks and preview acceptance are required before merging.

## Verification completed locally

### Pull request release-check fixes

- [x] Moved purchase-confirmation expiry calculation into server-side repository loading, removing the render-time `Date.now()` lint failure without disabling the purity rule.
- [x] Removed the stale pnpm lockfile, declared npm as the package manager and added [Vercel build settings](./vercel.json) using `npm ci` and `npm run build`.
- [x] Formatted the merged homepage and landing stylesheet. Fixed star-rating ARIA markup and light-theme contrast, and moved the keyboard/focus-restoration dialog test to the existing course-preview dialog.
- [x] Local lint, strict TypeScript, 41 Node tests, 10 React tests, full formatting check, production build and all 32 release browser tests passed for the fixes.
- [ ] Confirm the new GitHub Actions and Vercel preview checks on the pushed commit before merging. These checks do not apply shared migrations or establish production payment/DRM acceptance.

### Time-limited course access

- [x] Replaced the earlier lifetime-access requirement. Each course now has an administrator-configurable positive access period in days or calendar months, defaulting to one month. This access period is separate from video/runtime length.
- [x] Added [migration 011](./backend/database/migrations/202610310011_course_access_expiry.sql): snapshot each order's access terms, calculate enrollment expiry from successful payment, enforce expiry for purchases/manual grants and allow a fresh purchase after expiry. Existing progress and order history are retained. Later course edits do not change purchased terms.
- [x] Added server checks for private lessons, notes, progress, DRM token issuance and playback heartbeats. The local demo player stops paid playback and leaves the lesson at expiry; free previews remain available. This uses one-time payments, with no automatic recurring billing.
- [x] Displayed access periods on course cards/details/checkout, and expiry dates on confirmation, dashboard, classroom and receipts. Expired dashboard entries offer renewal; removed public lifetime-access promises.
- [x] Lint, strict TypeScript and 41 Node tests passed, including new month-end/leap-year, migration backfill, frozen-term, exact-expiry, manual-grant, denial and progress-preserving renewal checks.
- [x] All four purchase browser tests passed after this change, including checkout-to-receipt-to-lesson progress, failed/cancelled payments, signup/role denial, and 12 desktop/mobile/theme combinations with accessibility checks. The earlier development-lock blocker was absent for this run; no production build or real merchant acceptance is claimed.
- [ ] Review/back up and apply migration 011 to shared staging after resolving earlier TLS/ledger issues and outstanding migrations. It backfills existing courses to one month and existing enrollments from their original payment/grant time; older access may expire immediately. Confirm actual course periods and legacy-customer treatment before shared rollout. No shared database changes or deployment were performed.
- [ ] Actual per-course durations, shared production migration, real merchant acceptance and physical-device DRM acceptance remain launch gates. Stored owner-authored FAQ/legal content also needs review for older access wording.

### Shared landing-page theme update

- [x] Added [shared brand styles](./frontend/styles/brand.css), loaded by the [root layout](./frontend/layouts/root-layout.tsx), to carry the landing page's neutral backgrounds, emerald/teal actions, grid, rounded cards and form styling across public, account, purchase, classroom and admin surfaces.
- [x] Preserved existing fonts and page hierarchy, payment/authentication logic, disabled controls, mobile layouts and printable receipts. Added coordinated light-theme tokens and compact header buttons.
- [x] Lint, strict TypeScript, CSS/editor diagnostics and changed-file formatting passed. Checked catalogue, login, about, contact and terms at desktop/mobile widths without horizontal overflow.
- [x] Created a separate local UI-review account, completed a mock purchase and opened its confirmation, dashboard, purchase history and protected lesson. Twelve dashboard/history/classroom combinations (desktop/mobile, dark/light) passed main-content Axe WCAG A/AA checks with reduced motion and no horizontal overflow.
- [ ] Full purchase-suite rerun: its isolated server could not start while the existing demo server held the development lock. The browser walkthrough above used that existing server instead. Full production build, admin visual acceptance and external placeholder-video playback were not verified for this theme update.

| Check                             | Recorded result                                                             |
| --------------------------------- | --------------------------------------------------------------------------- |
| `npm run check`                   | Lint, strict TypeScript and 39 Node tests passed                            |
| `npm run test:unit`               | 10 React tests passed                                                       |
| `npm run test:release`            | 32 production-browser regression tests passed                               |
| `npm run test:purchase`           | 4 purchase-flow end-to-end tests passed                                     |
| Responsive/accessibility coverage | 12 page/viewport/theme combinations and 12 Axe audits in the purchase suite |
| Production build                  | Passed                                                                      |
| Local seed                        | Passed without writing to Supabase                                          |

**Verification timing:** after merge commit `0a00936`, `npm run check` passed lint, strict TypeScript and all 39 Node tests. Subsequent CSS-only adjustments passed editor CSS diagnostics and `git diff --check`. The React tests, browser suites, seed and production build in the table are previously recorded purchase-flow results and were not rerun after the homepage merge. No new browser visual acceptance is claimed. No application tests were rerun for this documentation consolidation.

The previously recorded 85 automated tests cover provider safety, settlement, access, signup/login, failed/cancelled payments, duplicate verification, tampered amounts, cross-origin rejection, private receipts and persisted lesson progress. The table combines the fresh post-merge check with earlier implementation results, as distinguished above. Earlier Lighthouse results belong to the Phase 6 baseline and were not remeasured for this feature.

## Remaining before live sales

These items are open; they must not be marked complete based only on local tests.

| Priority | Remaining work                                                  | Dependency / completion evidence                                                                                                                                                                                                     |
| -------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1        | Resolve shared database TLS trust and migration-ledger mismatch | Trusted Supabase CA and a reviewed, matching migration history. Migration 008 was historically reported applied on 30 October; do not replay it blindly. Current shared-schema acceptance remains unresolved.                        |
| 2        | Review and apply outstanding migrations 009, 010 and 011        | Authorized shared database access, backups and successful schema/role/settlement verification. No shared migration was applied during the new purchase-flow implementation.                                                          |
| 3        | Restore hosting access and deploy a staging build               | Earlier saved Vercel project lookup returned 404 and the CLI lacked credentials. Access must be restored and checked; no deployment is claimed.                                                                                      |
| 4        | Complete actual Razorpay test-mode acceptance                   | Merchant approval/test credentials, separate webhook secret and registered `/api/webhooks/razorpay`; verify capture, callback, duplicate/retried webhooks, browser-close recovery and full refunds against the real provider.        |
| 5        | Configure durable production auth and database                  | Supabase credentials and approved app origin; verify actual signup/email verification, password reset, OAuth if enabled, student access and staff MFA on the hosted app. Local file storage is not a serverless production database. |
| 6        | Supply approved catalogue and business content                  | Final course selection, prices, instructor details, copy, business identity, terms, privacy and refund policies. Three sample courses are test content.                                                                              |
| 7        | Upload and accept real protected videos                         | Confirm VdoCipher budget/limits, upload approved lessons, map processed video IDs and retain private source backups. Verify playback, watermark, domain restrictions and revocation on Windows, Android and iPhone devices.          |
| 8        | Approve tax and invoice requirements                            | Owner/accountant-approved tax classification and invoice/customer fields. Printable purchase receipts are acknowledgements, not statutory GST invoices; GST-enabled checkout remains gated.                                          |
| 9        | Verify real email delivery and background operations            | Approved Resend sender, inbox receipt/delivery retries, reconciliation schedules and actionable monitoring/alerts. Existing code alone does not prove hosted operation.                                                              |
| 10       | Complete domain and infrastructure setup                        | Final brand/name checks, current domain availability/cart approval, registration, DNS and HTTPS. No domain purchase is claimed.                                                                                                      |
| 11       | Complete operational/security acceptance                        | WAF/bot controls, edge rate limits, scoped/rotated secrets, backups and demonstrated restore, staging payment/security and load testing.                                                                                             |
| 12       | Enable live payments only after staging acceptance              | Live Razorpay keys, correct webhook/app origin, `LOCAL_DEMO=false`, `SEED_DEMO_USERS=false` and `ALLOW_MOCK_PAYMENTS=false`. Never copy demo users/data into production.                                                             |

Migration references: [009: commerce operations](./backend/database/migrations/202610310009_commerce_operations.sql) and [010: purchase access](./backend/database/migrations/202610310010_purchase_access.sql). Earlier commerce acceptance details: [Phase 3 status](./docs/PHASE-3-STATUS.md).

## Optional or deferred work

- [ ] Completion certificate at 100% progress: optional and not implemented.
- [ ] Coupon redemption in checkout: not wired; existing administrator coupon management does not establish redemption support.
- [ ] Partial/split refunds, disputes and additional merchant variants: separate implementation/acceptance if required; do not assume full-refund coverage includes them.
- [ ] Further homepage redesign beyond the merged version and requested spacing fixes: only if requested; current visual/content acceptance tasks are listed above.

A website cannot guarantee prevention of every screen recorder, camera or capture card. Physical-device DRM acceptance is still required; headless token tests and local sample-video playback do not establish that acceptance.

## What can be used now

Run the isolated local demo:

```powershell
npm ci
npm run db:seed
npm run dev:demo -- --port 3001
```

Student: `demo@example.com` / `1234567890`. Demo administrator: `admin@example.com` / `1234567890`.
Open <http://127.0.0.1:3001>.

Log in as the student, choose a sample course, complete a mock payment, open the dashboard and mark a lesson complete. Failure and cancellation can also be tested without charging money. Reseeding preserves existing purchases; an account used previously may already own a course. The isolated demo administrator uses the demo dashboard, not production administrator tools.

The demo runner clears external credentials only in its child process and does not edit your environment file. Use the normal app startup with configured keys for real Razorpay testing; the isolated demo runner deliberately stays in mock mode.

## Historical decisions retained

- Migration 008 was reported applied on 30 October 2026 with eight staging security/settlement checks passing. Phase 2 recorded 25 learner-journey checks, including preview/locked lessons, email verification, two-device limits, payment isolation, progress, resume and refund/revocation denial. These historical results do not resolve the later TLS/ledger mismatch.
- Keep VdoCipher for private encoding, adaptive delivery, DRM and watermarking, with separate private master backups. Cloudinary, VPS, Cloudflare Stream and Bunny comparisons remain in the [priority report](./docs/PRIORITY-WORK-2026-10-30.md). Request a quote based on course minutes, viewing hours, India traffic, encoded storage, egress and export terms.
- Market Method remains provisional; Chart Saathi is an alternative. `marketmethod.in` and `chartsaathi.in` were recorded as available on 30 October 2026. Historical Hostinger pricing was INR 1 for the first year with a three-year term, then INR 899/year (INR 1,799 before GST across three years); `.com` regular/renewal was recorded as INR 1,499. These are historical observations, not current availability or pricing. Recheck the full cart, trademarks and social handles before purchase.
- Earlier mobile Lighthouse scores of 100 performance/accessibility, LCP 1.06s and CLS 0.004 belong to the Phase 6 baseline, not the current merged homepage.
