# Priority website work

Updated: 31 October 2026 (IST). Detailed findings, learner states, hosting comparison, and launch gates: [priority work report](./docs/PRIORITY-WORK-2026-10-30.md). Fresh verification supersedes older summaries below: [Phase 6 status](./docs/PHASE-6-STATUS.md) and [operational runbook](./docs/OPERATIONS-RUNBOOK.md).

**Latest implementation:** the locally possible commerce work is delivered: Cashfree sandbox order creation, API-confirmed webhook/reconciliation, approved full-refund dispatch/recovery, private PDF/HTML billing documents and credit notes, transactional email queues, protected scheduler/monitoring code and targeted security tests. Local lint/type/build/format checks, **35 Node tests, 10 React tests and 32 production-browser tests** pass. See [Phase 3 implementation and remaining gates](./docs/PHASE-3-STATUS.md). Earlier mobile 4G Lighthouse was 100/100 with LCP 1.06s/CLS 0.004; it has not been remeasured for this commerce follow-up. Real merchant testing, final GST invoice details, approved content and physical-device DRM remain open.

**Fresh staging check:** migration-ledger matching failed; strict TLS now requires the trusted Supabase CA. Historical application/verification of migration 008 is not current schema acceptance. Hosting is also blocked: the saved Vercel project returns 404 via the connector and the local CLI has no credentials. No shared database changes or deployment were made in this session.

## 1. Course flow and learner journey — implemented for staging, real payment pending

**Done**

- Mapped the learner journey and states in the [priority work report](./docs/PRIORITY-WORK-2026-10-30.md): browse a course and optional free lesson → sign up or log in and verify email → review course price and terms → wait for payment confirmation → open My learning → stream lessons, read notes, track completion, and resume.
- Checkout, payment status, learning library, and classroom now handle pending, paid, failed/cancelled, locked, empty, completed, and recoverable-error states more clearly.
- Demo checkout code calculates price and tax from the database, validates course publication and ownership, and grants access only through a matching paid order. The new database function makes the demo settlement and enrollment atomic.
- Cashfree now has its own sandbox-only adapter and hosted checkout. API-confirmed payment settlement atomically writes enrollment, billing snapshot and purchase email queue. Failed attempts may be retried on the same order; successful/refunded purchases cannot be downgraded or reactivated.
- Approved full refunds query the provider before dispatch, reuse one reference after timeouts and revoke access only after matching confirmed success. Billing PDF/HTML downloads and credit notes are private. Email failures do not undo enrollment.

**Remaining**

- [x] Apply [migration 008](./backend/database/migrations/202610300008_payment_hardening.sql) to the shared staging database after explicit authorization, then verify a complete demo purchase with a disposable account. **Applied 30 Oct 2026 — all 8 staging verification tests passed** (amount mismatch, failed-no-enroll, terminal guard, atomic paid+enroll, duplicate idempotency, already-enrolled block, role denial, consistency check).
- [x] Phase 2 — Course flow and learner journey verification complete. **Verified 30 Oct 2026:** free preview accessibility vs locked paid lessons, unverified email rejection, 2-device admission limit, database price/GST/refund policy accuracy, pending order isolation (never grants access), 2-minute pending payment polling window with "Check again" safety, paid atomic settlement & enrollment, lesson selection, heartbeat progress tracking, notes, completion %, resume point, and instant access denial on refund or enrollment revocation. All 25 automated tests and live staging verification passed.
- [x] Implement and locally test the Cashfree sandbox adapter, verified consumer/reconciliation, private billing documents, full refunds, email queue and scheduler integration. **Done 31 Oct 2026; controlled provider responses and disposable database tests, not actual merchant acceptance.**
- [ ] Resolve existing staging trust/ledger issues; review/apply [migration 009](./backend/database/migrations/202610310009_commerce_operations.sql) with authorisation, then complete an actual sandbox purchase/webhook/refund/email/download journey. No shared migration was applied in this session.
- [ ] Supply/approve business and customer tax inputs and invoice classification. GST-enabled sandbox checkout is currently blocked; no statutory invoice compliance is claimed. Production payment and worker enablement still require acceptance.
- [ ] Replace the staging verification course and illustrative catalogue entries with two owner-approved courses, final prices, videos, instructor details, and policies.

## 2. Landing page — redesign reverted at your request

**Done**

- Restored the landing page, its styles, and original media assets to their pre-work state. The generated sky image was removed. The earlier visual inspection applied to the reverted version and is not a current acceptance result.

**Remaining**

- [ ] Landing-page improvement is deferred. If reopened, use the supplied reference and approved two-course content as the design brief.
- [ ] Confirm final brand, instructor assets, course copy, and any approved social proof before public launch.

## 3. Video download and screen recording protection — controls added, device acceptance pending

**Done**

- Premium video stays with VdoCipher. The server checks a learner's entitlement and admitted device before issuing a short-lived, site-bound DRM playback token; private video IDs and API secrets are not sent as public course data.
- Added a five-minute token expiry, URL whitelist, per-viewer moving watermark, and playback stop on a failed progress heartbeat. No premium MP4 download or offline option is offered by the site.

**Remaining and hard limit**

- [ ] Verify actual DRM playback, watermark, domain whitelist, revocation, and capture behavior on supported Windows/Android/iPhone browsers and devices. The existing headless browser lacks Widevine, so token issuance alone does not prove playback.
- A website cannot stop a camera, capture card, or every screen recorder. Developer tools can show encrypted segments and a short-lived token because the browser needs them to play; DRM prevents ordinary reuse without a license. Do not promise absolute download or screen-record prevention.

## 4. Video storage — recommendation ready, provider selection/budget pending

**Done**

- Recommend keeping the two approximately 4 GB source courses in **VdoCipher** for private encoding, adaptive delivery, DRM and watermarking. Keep separate private backups of the masters. The app is already integrated with this provider.
- Compared Cloudinary, a VPS, Cloudflare Stream, and Bunny Stream in the [report](./docs/PRIORITY-WORK-2026-10-30.md). Basic signed URLs or a VPS alone do not meet the DRM requirement.

**Remaining**

- [ ] Get a VdoCipher quote using total course minutes, expected monthly viewing hours, India traffic, and required DRM plan; confirm upload limits, encoded storage, egress, and export terms.
- [ ] Upload the approved lessons privately and map each processed provider ID to its verified course lesson.

## 5. Attack resistance — strengthened, not declared invulnerable

**Done**

- Added a rotating nonce Content Security Policy, tighter browser permissions and HTTPS HSTS where configured.
- Closed a demo-payment authorization gap: a logged-in student can now simulate only their own order. The demo mode needs an explicit staging setting and a strong secret; signed webhooks reject stale, malformed, replayed, or mismatched events. SQL settlement is atomic and service-role-only.
- Kept server-side input validation, database role restrictions, private keys, session/device checks, staff MFA, and protected lesson access. Local security tests include role denial, tampering, duplicate events, and rollback on a failed grant.
- Production dependency audit reported zero known advisories at the time of checking.

**Remaining**

- [x] Apply and verify migration 008 in staging after authorization. **Done — 30 Oct 2026.**
- [x] Implement protected scheduler/reconciliation and aggregate monitoring endpoint, durable job retries, private billing ownership checks and sandbox-only provider actions. **Local tests pass; endpoint/sending default disabled.**
- [ ] Configure deployment WAF/bot controls, edge rate limits, monitoring and alerts; verify backups/restores and rotate/limit secrets before launch.
- [ ] Run staging penetration and payment-flow testing after real Cashfree integration. No site can be guaranteed safe from all attacks.

## 6. Website name/domain — options checked, not purchased

**Done**

- Hostinger showed [marketmethod.in](https://www.hostinger.com/in/domain-name-results?domain=marketmethod.in&from=domain-name-search) and [chartsaathi.in](https://www.hostinger.com/in/domain-name-results?domain=chartsaathi.in&from=domain-name-search) as available on 30 October 2026. Market Method is the current provisional brand; **Chart Saathi** is an India-focused alternative.
- Hostinger advertised .in at ₹1 in year one **with a three-year term**, then ₹899/year. The implied three-year total is ₹1,799 before GST, subject to the live cart. .com showed a higher ₹1,499 regular/renewal price.

**Remaining**

- [ ] Choose the name, check trademarks and social handles, recheck availability and the complete Hostinger cart, then register and connect the domain. No name or price is reserved.

## Verification and launch status (superseded by 31 October recheck)

- **Passed locally, current code:** production build, lint, TypeScript, formatting, 35 automated Node tests, 10 React tests and 32 production-browser tests. The earlier mobile performance/accessibility 100/100 report belongs to the Phase 6 baseline. See Phase 3/6 reports for exact scope.
- **Passed on staging:** migration 008 applied and verified 30 Oct 2026 — amount mismatch, failed settlement, terminal guard, atomic paid+enroll, duplicate idempotency, already-enrolled block, role denial, and consistency check all passed against the shared staging database.
- **Not passed/blocked now:** trusted staging connection/matching ledger and application of migration 009; hosted deployment; actual Cashfree sandbox acceptance and production enablement; approved GST invoice details; real inbox delivery and scheduling/alerts; DRM/capture acceptance; approved courses/content; production operations and restore acceptance. Coupon redemption and unsupported payment/refund variants remain explicitly listed in Phase 3.
- The earlier auto-review rejection and later reported migration application are historical events. The current unresolved issue is fresh schema/ledger acceptance, not a claim that migration 008 was never applied. Never replay it blindly.
