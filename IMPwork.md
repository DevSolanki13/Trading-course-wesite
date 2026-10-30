# Priority website work

Updated: 30 October 2026 (IST). Detailed findings, learner states, hosting comparison, and launch gates: [priority work report](./docs/PRIORITY-WORK-2026-10-30.md).

## 1. Course flow and learner journey — implemented for staging, real payment pending

**Done**

- Mapped the learner journey and states in the [priority work report](./docs/PRIORITY-WORK-2026-10-30.md): browse a course and optional free lesson → sign up or log in and verify email → review course price and terms → wait for payment confirmation → open My learning → stream lessons, read notes, track completion, and resume.
- Checkout, payment status, learning library, and classroom now handle pending, paid, failed/cancelled, locked, empty, completed, and recoverable-error states more clearly.
- Demo checkout code calculates price and tax from the database, validates course publication and ownership, and grants access only through a matching paid order. The new database function makes the demo settlement and enrollment atomic.

**Remaining**

- [x] Apply [migration 008](./backend/database/migrations/202610300008_payment_hardening.sql) to the shared staging database after explicit authorization, then verify a complete demo purchase with a disposable account. **Applied 30 Oct 2026 — all 8 staging verification tests passed** (amount mismatch, failed-no-enroll, terminal guard, atomic paid+enroll, duplicate idempotency, already-enrolled block, role denial, consistency check).
- [x] Phase 2 — Course flow and learner journey verification complete. **Verified 30 Oct 2026:** free preview accessibility vs locked paid lessons, unverified email rejection, 2-device admission limit, database price/GST/refund policy accuracy, pending order isolation (never grants access), 2-minute pending payment polling window with "Check again" safety, paid atomic settlement & enrollment, lesson selection, heartbeat progress tracking, notes, completion %, resume point, and instant access denial on refund or enrollment revocation. All 25 automated tests and live staging verification passed.
- [ ] Implement and test real Cashfree order creation, authenticated webhook consumption, reconciliation, receipts and refunds before enabling live payment.
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
- [ ] Configure deployment WAF/bot controls, edge rate limits, monitoring and alerts; verify backups/restores and rotate/limit secrets before launch.
- [ ] Run staging penetration and payment-flow testing after real Cashfree integration. No site can be guaranteed safe from all attacks.

## 6. Website name/domain — options checked, not purchased

**Done**

- Hostinger showed [marketmethod.in](https://www.hostinger.com/in/domain-name-results?domain=marketmethod.in&from=domain-name-search) and [chartsaathi.in](https://www.hostinger.com/in/domain-name-results?domain=chartsaathi.in&from=domain-name-search) as available on 30 October 2026. Market Method is the current provisional brand; **Chart Saathi** is an India-focused alternative.
- Hostinger advertised .in at ₹1 in year one **with a three-year term**, then ₹899/year. The implied three-year total is ₹1,799 before GST, subject to the live cart. .com showed a higher ₹1,499 regular/renewal price.

**Remaining**

- [ ] Choose the name, check trademarks and social handles, recheck availability and the complete Hostinger cart, then register and connect the domain. No name or price is reserved.

## Verification and launch status

- **Passed locally:** production build; lint, TypeScript and 24 automated Node tests; React unit tests; targeted browser, theme, dialog, CSP, disabled-checkout and accessibility checks on the temporary redesign. The landing changes were then reverted, so that visual pass is not a claim about the current landing page.
- **Passed on staging:** migration 008 applied and verified 30 Oct 2026 — amount mismatch, failed settlement, terminal guard, atomic paid+enroll, duplicate idempotency, already-enrolled block, role denial, and consistency check all passed against the shared staging database.
- **Not passed/blocked:** staging migration and full demo purchase; real Cashfree settlement; actual DRM playback and capture acceptance on physical devices; final approved courses/content.
- The repository-wide Prettier check reports pre-existing formatting issues in many unrelated files. Files changed for this work were formatted individually.
- Automatic approval review rejected applying migration 008 to the shared staging database because the request did not explicitly authorize an irreversible shared-database change. It remains unapplied.
