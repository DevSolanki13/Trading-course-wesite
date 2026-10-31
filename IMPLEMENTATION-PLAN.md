# Trading Course Website: Implementation Plan and Project Status

**Last updated:** 31 October 2026 (Asia/Kolkata)\
**Requested delivery:** Friday, 30 October 2026, end of day IST (working assumption; exact handover time unconfirmed)  
**Original launch:** Monday, 2 November 2026, with work finished by 1 November  
**Source:** [Course website requirements](./course-website-requirements.md)  
**Current stage:** Phase 6 local verification plus sandbox commerce/refund/billing/email/scheduler implementation delivered; staging trust/ledger, deployment, provider and DRM acceptance pending\
**Delivery confidence:** At risk for the full requirements by tomorrow

## 1. What this document controls

This is the implementation order, design brief, research record, acceptance checklist, and live project tracker. The latest request brings the delivery target forward to 30 October. All original requirements remain recorded here; moving an item to a later release is a proposed scope decision, not an accepted removal.

**Reality check:** the initial workspace contained only the requirements document. Phase 0 has now added the application scaffold, dependency lockfile, initial SQL migration, tests, setup documentation and Vercel staging linkage. The local production build passes, but staging database migration is now verified, while remaining external provider credentials, video playback and email delivery remain pending. A complete production commerce and DRM learning platform from this starting point is not a reliable one-day commitment. Tomorrow should target a reviewable working release candidate. Accepting real payments remains conditional on the launch gates in section 12. If those gates fail, deliver a staging preview with checkout disabled and a precise remaining-work list.

The local foundation, staging database, public storefront and Phase 2 account/security implementation are available. Real email delivery and Google consent acceptance remain open; purchases and paid learning are later phases. See [Phase 0](./docs/PHASE-0-STATUS.md), [Phase 1](./docs/PHASE-1-STATUS.md) and [Phase 2](./docs/PHASE-2-STATUS.md) for evidence and acceptance gaps.

## 2. Current project status

Status values: **DONE**, **IN PROGRESS**, **NOT STARTED**, **AWAITING INPUT**, **BLOCKED**, **DEFERRED (PROPOSED)**. A checkbox means its acceptance criteria were verified, not just that code was written.

| Area | Status | Evidence / next action |
|---|---|---|
| Requirements review | DONE | Source requirements read and mapped to phases below |
| Workspace inspection | DONE | Only the requirements document existed before this plan |
| Initial desk research | DONE | Public sources reviewed; findings and limitations in section 4 |
| Implementation plan and tracker | DONE | This document |
| Brand, wireframes, visual assets | IN PROGRESS | Provisional Market Method identity, tokens, original artwork/covers and 364 KB ambient video implemented; owner identity/photo approval pending |
| App foundation and database | IN PROGRESS | Nine migrations pass isolated local tests. Migration 009 is unapplied to shared staging. Fresh staging trust/ledger acceptance remains blocked; inspect drift before applying anything |
| Authentication and device limit | IN PROGRESS | Implementation and live staging device/password/MFA tests pass; Resend operator message delivered using testing sender; Google enabled and app PKCE initiation passed. General-recipient sender verification and Google consent/callback acceptance remain open |
| Public website and legal content | IN PROGRESS | Homepage, catalogue, three course previews, approach/contact and draft policy pages implemented; real content/approval pending |
| Payments, receipts and refunds | IN PROGRESS | Cashfree sandbox checkout/API confirmation/reconciliation, full refunds, private PDF/HTML billing/credit notes and transactional email queues are implemented and locally tested. Actual merchant/email acceptance, approved tax invoice inputs, coupon redemption and live enablement remain open |
| DRM player and watch tracking | IN PROGRESS | Backend VdoCipher integration, leases, resume and unique watched ranges implemented; actual automated playback blocked by unavailable Widevine. Physical-browser acceptance pending |
| Student dashboard and community | IN PROGRESS | Library, classroom, progress, private orders and eligibility-gated community implemented; real content/invites and Phase 3 receipts remain pending |
| Admin and support workflows | IN PROGRESS | Phase 5 Admin/course/student/refund-review code, migrations 005–006 and staging browser/accessibility acceptance verified. Cashfree refunds and reconciliation remain deferred |
| QA, performance and accessibility | IN PROGRESS | Fresh build/lint/type/format checks, 35 Node tests, 10 React tests and 32 production-browser tests pass. Prior Phase 6 mobile Lighthouse 100/100 was not repeated for this follow-up; hosted/provider/DRM/restore acceptance remains open |
| Deployment and live readiness | IN PROGRESS | Local staging link exists but connector returns 404 for the saved team/project and CLI has no credentials. No deployment or live-sales readiness verified |
| Owner content and service readiness | AWAITING INPUT | Checklist in section 3; availability unconfirmed |

**Progress reporting:** planning, foundation, staging migrations, storefront and account/security implementation are delivered. Full Phase 2 acceptance requires email delivery and Google browser verification. Owner content approval and commerce/video launch integrations remain pending. Do not turn these into an invented percentage.

### How status stays updated

The implementer updates this file at the start and end of every work session and after every phase gate. This is a maintained Markdown tracker, not automatic monitoring.

1. Set the active phase and update its status when work starts.
2. Check tasks only after the associated behavior is verified.
3. Attach evidence: real code paths, migration identifiers, test results, screenshots, preview URL, or provider event IDs. Never paste secrets or student information.
4. Record blockers with owner, impact, next action and next review time.
5. Update the handover section with working features and remaining gaps.
6. If scope or timing changes, update this document explicitly; keep the original requirement mapped.

**Next task:** follow [Phase 3 implementation/acceptance](./docs/PHASE-3-STATUS.md), [Phase 6](./docs/PHASE-6-STATUS.md) and [the runbook](./docs/OPERATIONS-RUNBOOK.md): restore trusted staging access, investigate ledger drift, restore the saved Vercel project, then review/apply migration 009 with shared-database authorisation and run actual sandbox purchase/refund/billing/email acceptance. Approved tax inputs, courses/videos, physical-device DRM, email/Google and production operations remain launch gates. Live payment and domain purchase are not enabled by this work.

**31 October evidence supersedes earlier status summaries:** lint, TypeScript, formatting, build, 35 Node tests, 10 React tests and 32 isolated production-browser tests pass. Cashfree responses in tests are controlled fixtures, not actual merchant acceptance. The previous local Lighthouse measurement remains historical evidence for the Phase 6 baseline. Shared staging trust/ledger and hosting access remain unresolved; no shared migration, real transaction/email or deployment was performed. Migration 009 is local only.

## 3. Inputs and external dependencies

These are questions about readiness, not reasons to delay independent design and scaffolding work. Credentials must be configured through protected environment settings, never committed into Markdown or sent in public messages.

| Needed | Owner | Current status | Effect if missing |
|---|---|---|---|
| Instructor name, real photo, biography, support contact and approved credibility claims | Business owner | AWAITING INPUT | Use labelled staging content; do not publish invented credentials |
| Brand/business name and domain | Business owner; developer proposes identity | AWAITING INPUT | Temporary staging identity; no final domain cutover |
| 2–3 course titles, prices, learning outcomes, level, module order and Hindi-language videos | Instructor | AWAITING INPUT | Cannot sell or verify the promised courses |
| At least one trailer/free preview per course; total lesson durations | Instructor | AWAITING INPUT | Preview, refund denominator and player QA incomplete |
| Cashfree account, KYC/live status, sandbox/live credentials and webhook configuration access | Business owner | UNVERIFIED | Sandbox demonstration only; live purchase blocked |
| VdoCipher account, adequate plan, API credentials and processed videos | Business owner + instructor | UNVERIFIED | Paid DRM playback cannot be signed off |
| Supabase project and production access | Developer/business owner | UNVERIFIED | Persistent auth/database flows unavailable |
| Google OAuth client and allowed redirect domains | Developer/business owner | UNVERIFIED | Google sign-in cannot be accepted |
| Resend account, verified sending domain and DNS access | Business owner/developer | UNVERIFIED | Real verification/reset/receipt emails cannot be accepted |
| Public Telegram, private-group setup and Instagram links | Instructor | AWAITING INPUT | Community flows incomplete |
| GST registration/treatment, GSTIN if applicable, business billing details | Business owner/accountant | AWAITING INPUT | No tax collection until correct settings and invoice fields are established |
| Refund policy, terms, privacy and trading-content/legal review | Business owner | AWAITING INPUT | Production sale remains gated |
| Hosting/domain access, service budget and expected audience size | Business owner | AWAITING INPUT | Capacity and recurring cost assumptions remain provisional |
| Genuine testimonials, consent and licensed background footage | Instructor/developer | AWAITING INPUT | Omit unsupported social proof; use an approved poster if video is unavailable |

Start Cashfree activation and video uploads immediately. Neither approval time nor encoding time is under the developer's control. Verify vendor pricing, plan restrictions, browser support, email quotas and backups before subscribing; no current costs have been confirmed.

**GST clarification:** the source allows GST off until GSTIN is supplied. That is a UI requirement, not a determination of the business's tax obligations. The owner/accountant must confirm the lawful launch configuration.

## 4. Market research and product decisions

**Research date:** 29 October 2026. This is focused desk research of public pages, not interviews, a market-size study or access to competitor conversion data. Prices and catalogues can change. Competitor marketing claims are not independently verified.

| Reference | Observed evidence | Decision for this website |
|---|---|---|
| [Zerodha Varsity](https://zerodha.com/varsity/) | Free, open-access market education with modules and videos | Generic information alone is a weak paid proposition. Demonstrate the instructor's teaching method, a structured Hindi learning path, worked examples and a real preview |
| [Elearnmarkets](https://www.elearnmarkets.com/) | Course discovery by level, specific skills, named instructors, durations, pricing and learner reviews | Show level, prerequisites, Hindi language, hours, curriculum and instructor identity before asking for payment |
| [FinGrad](https://joinfingrad.com/) and [catalogue](https://joinfingrad.com/courses?page=1&sort=recommended) | Topic-based discovery, instructor profiles, course/plan entry points and Telegram support links | Keep our 2–3-course catalogue easy to compare; distinguish public community from purchased access |
| [SEBI research release, September 2024](https://www.sebi.gov.in/media-and-notifications/press-releases/sep-2024/updated-sebi-study-reveals-93-of-individual-traders-incurred-losses-in-equity-fando-between-fy22-and-fy24-aggregate-losses-exceed-1-8-lakh-crores-over-three-years_86906.html) | The historical FY22–FY24 study reported widespread losses among individual equity F&O traders | Lead with education, discipline and risk management. Do not promise income, guaranteed returns or recovery of course fees through trading |

The SEBI reference concerns a specific historical period; it is not presented as the latest market statistic or a forecast of a learner's results. Have the owner verify applicable current rules and registration/disclosure obligations before publication. A disclaimer alone does not establish compliance.

### Positioning recommendation

**Working promise:** “Learn the process behind a trade.”  
**Supporting draft:** “Structured Hindi lessons on market basics, risk and trading decisions, taught through practical chart examples.”

Final wording must match the actual curriculum. Sell a clear learning experience: who it is for, what is taught, how it is taught, and what purchase includes. Do not imply mentorship, trade signals, live classes or individual advice unless actually included and reviewed.

### Audience and purchase journey

- **Primary hypothesis:** Hindi-speaking Indian beginners arriving from Instagram or Telegram, comparing usefulness and credibility on a phone.
- **Secondary hypothesis:** learners with basic experience seeking one specific strategy or a more structured process.
- **Trust questions to answer:** Who teaches this? Can I understand their teaching? Is this my level? What is the complete cost? How does access work? What is the refund rule?
- **Journey:** social link → course/landing page → free sample → curriculum and price → login → checkout → verified payment → first lesson.

These are design hypotheses, not measured audience findings. Validate through launch analytics and short learner interviews after release.

### Pricing and conversion

The reviewed Elearnmarkets homepage lists a beginner programme at INR 3,000 and separate specialist offerings at higher prices. These differ in format and scope; they are not a valuation of this instructor's courses. Keep final prices owner-approved, compare equivalent delivery/access terms, and do not copy competitor discounts.

Show the base price and “+ GST” wherever applicable, then show the final payable total before Cashfree opens. Use real sale prices only; omit artificial countdowns, fake scarcity, fabricated student counts and unsupported profit screenshots. Genuine testimonials should describe learning and teaching, with consent and appropriate risk context.

### How success will be measured

Track course views, preview starts, checkout starts, server-confirmed purchases and first-lesson starts. Report funnel drop-off by device/source without sending email, phone, tokens or payment details to analytics. Establish a baseline before setting conversion promises. The under-one-minute purchase goal is a usability target after course selection; verification, Google and UPI completion times vary.

## 5. Visual direction and background-video brief

**Design read:** a premium trading-education storefront for Indian mobile learners, with restrained dark editorial styling and recognisable instructor-led content. Public pages can be expressive; the player, checkout and admin should be calm and functional.

### Brand foundation

- Developer proposes a simple wordmark and a small original geometric mark based on decision-making/structure. Final business name remains an owner input.
- Dark palette: ink `#0B1012`, surface `#151D20`, warm-white text `#F3F1E9`, muted text `#A8B3B5`, teal accent `#69D6BC`.
- Light palette: background `#F4F5F1`, white surface, ink text and deeper teal `#126B5A` for suitable contrast. Validate real combinations rather than assuming every token passes.
- Typography: self-hosted or framework-optimised Manrope for headings/body and IBM Plex Mono sparingly for durations/prices. Limit font weights. Use tabular numbers for money.
- Use original course covers that reflect actual lesson subjects. Use real instructor photography and genuine lesson frames; no generated instructor identity or fabricated interface screenshots.
- One consistent icon family, visible focus rings, 16px minimum body text and comfortable tap targets around 44px.
- Avoid generic purple glows, repeated glass cards, decorative dashboards, endless ticker strips, fake charts climbing upward, and vague “unlock your potential” copy.

### Homepage composition

| Section | Content / visual treatment | Primary purpose |
|---|---|---|
| Navigation | Wordmark, Courses, Instructor, FAQ, login/dashboard | Simple orientation; compact mobile menu |
| Hero | Short value statement, supporting sentence, Explore courses CTA and Watch sample action; restrained video crop | Establish the offer with the CTA visible on a small laptop |
| Teaching sample | User-triggered real Hindi lesson clip and a concise explanation of the method | Let visitors judge teaching quality |
| Course collection | 2–3 comparable covers with level, Hindi tag, duration, lesson count and price | Help the learner choose |
| Learning path | Clear progression through fundamentals, risk and relevant strategies; only actual curriculum | Make the learning structure tangible |
| Instructor | Real portrait, verified biography and specific teaching approach | Establish credible identity |
| Student feedback | A few genuine quotes if available; omit until verified | Supply honest evidence |
| Community | Clear public Telegram and Instagram links; explain paid community inclusion | Set expectations without exposing private invite links |
| FAQ and footer | Access, devices, refunds, tax, risk, support and legal links | Resolve purchase objections |

Vary composition through a full-width media section, a compact course collection, a portrait-led biography and simple FAQ rows. Keep page length purposeful. Avoid putting every paragraph in a card. On mobile use a deliberate single-column layout; the course-detail purchase bar must not cover content or controls.

### Background video specification

This plan includes production of a background video asset during implementation; no video has been created or licensed yet.

- **Concept:** an 8–12 second silent loop of the instructor's desk, annotated chart study and notebook details, with deliberate framing and subtle movement. Show practice and analysis rather than luxury lifestyle or profit imagery.
- Prefer original instructor footage. Otherwise use properly licensed footage, recording source, licence and permitted use. Avoid readable personal/account information and copied trading-platform branding.
- Prepare a desktop crop, mobile poster and compressed WebM/MP4 variants. The MP4 restriction in the requirements concerns paid course content; public decorative footage is a separate asset class.
- Proposed budget: desktop loop approximately 1–2 MB and poster below 150 KB, subject to measured visual quality. Prefer a static mobile poster at launch; offer user-triggered video where useful.
- Render the poster and headline immediately. Load decorative video after critical content, with `muted`, `playsInline` and a permanent fallback if autoplay fails. Never block the CTA on media loading.
- Disable decorative autoplay for reduced motion and supported data-saving signals; default to the poster on mobile. Pause when outside the viewport or when the tab is hidden.
- Provide a keyboard-accessible pause/play control for an automatically moving background. Keep sufficient text contrast in every frame. Decorative media is hidden from assistive technology; meaningful lesson clips have accessible controls and transcript/caption support where supplied.
- Checkout, authentication, dashboard and lesson pages have no decorative background video.

[web.dev's video-loading guidance](https://web.dev/articles/lazy-loading-video) supports poster-first presentation and deferring unnecessary media. Do not lazy-load the hero's LCP poster; defer the nonessential video bytes instead.

### Motion rules

Use short, purposeful transitions around 150–220 ms for buttons, menus, drawers and content changes. Prefer CSS and intersection-triggered reveals. Avoid scroll hijacking, heavy WebGL, custom cursors or animation that delays a purchase. Reduced motion removes parallax and decorative movement. Test both light and dark themes across all product areas.

## 6. Application architecture

**Repository structure:** full-stack monolith, single root package and unified repository, with a layered frontend, backend and database architecture. [Frontend](./frontend) contains presentation code, [backend](./backend) contains server handlers/configuration/security, and [backend database](./backend/database) contains persistence clients and SQL migrations. [Next.js route entries](./app) are thin framework adapters. There is one build/deployment and no separate frontend/backend package manifests. See [the architecture guide](./docs/ARCHITECTURE.md).

The core Next.js/TypeScript/Tailwind/Supabase client dependencies are installed and pinned in the root lockfile. Provider setup remains subject to Phase 0's external gates. Check provider documentation at integration time.

| Part | Choice | Reason / important boundary |
|---|---|---|
| Application | Next.js App Router + TypeScript | One application for public pages, student/admin areas and server endpoints |
| Styling | Tailwind CSS + accessible Radix-based components | Custom brand styling with established interaction primitives |
| Database/auth | Supabase PostgreSQL and Supabase Auth | Managed email/password, Google and database; reduce bespoke identity work |
| Email | Resend via auth SMTP where supported, plus transactional email API | Verification/reset through provider security; receipts/refund messages from app |
| Payments | Cashfree hosted checkout and Refunds API | Server-owned amounts, verified webhooks and reconciliation |
| Course video | VdoCipher DRM + per-viewer watermark | Backend playback authorisation; prove actual browser/plan support early |
| Hosting | Vercel; separate preview and production configuration | Public HTTPS webhooks and controlled release |
| Reliability | Provider-backed rate limiter, error monitoring, scheduled reconciliation and durable email retry | Must work across server instances; no memory-only counters |
| Analytics | Minimal funnel events initially, optional PostHog/Meta later | Keep financial truth in server orders; gate optional tracking appropriately |

If Supabase's session-revocation semantics cannot enforce the two-device rule immediately, add an application-controlled device registry checked by every protected server operation. Do not assume an identity provider's default sessions meet this requirement.

### Application areas

- Public: home, catalogue, course detail, instructor, contact, terms, privacy, refund policy and trading disclaimer.
- Auth: sign-up, email verification, login, Google callback, password reset, device-management challenge and separate admin entry.
- Student: my courses, learning player, browse courses, orders/receipt, refund request, profile/devices and community.
- Admin/support: overview, orders, refunds, students, course editor, marketing content, coupons, settings, staff and activity history. Render only allowed navigation and enforce permissions on the server too.

### Minimum data model

| Entity | Important fields / rules |
|---|---|
| Profiles / roles | Auth user ID, name, optional phone, role, blocked state; users cannot promote themselves |
| DeviceSessions | User/session reference, device label, last activity, expiry, revoked state; atomic limit enforcement |
| Courses | Unique slug, draft/published state, title, descriptions, level, language, cover, preview, price, sale price |
| Modules / lessons | Course/module reference, ordered position, duration, video provider ID, preview flag, notes; draft validation |
| Orders / order items | User, course, immutable price/discount/tax/business snapshots, INR totals in paise, provider order reference, lifecycle timestamps |
| PaymentAttempts / webhook events | Unique provider payment ID and event identity, validated amount/currency, status, processing outcome |
| Enrollments | User/course, source purchase/manual grant, active/revoked state; prevent duplicate active ownership |
| WatchIntervals / progress | User/lesson, validated watched ranges, resume position and completion; completion is separate from refund consumption |
| Refunds | Unique refund reference, order/item, reason, policy snapshot, eligibility evidence, reviewer, status and provider response |
| Coupons / redemptions | Percentage/fixed, course scope, expiry, limits, concurrency-safe reservations/redemptions |
| Invoices / receipts | Immutable order reference, invoice number where applicable, billing/tax fields, generation and email status |
| Settings / site content | Tax, refund, device/community settings, FAQs and approved testimonials; version changes |
| Audit log / outbox | Actor, action, target, timestamp, safe change details; retryable transactional messages/tasks |

All private records require ownership/role checks and database policies as appropriate. Keep service-role keys server-only. Store UTC timestamps and display IST; use integer paise for money. Verify indices and uniqueness constraints on orders, entitlements, payment IDs and refund IDs.

## 7. Phase-by-phase implementation

Effort ranges below are rough focused engineering hours, not a guarantee or an elapsed-time booking. They exclude account approval, owner feedback, video production and encoding. The combined full implementation is roughly **52–79 hours**, before optional later features. Phases have dependencies; compressing the schedule must not remove payment, permission or entitlement checks.

### Phase 0: Confirm inputs and prove integrations

**Priority:** immediate. **Estimate:** 2–3 hours. **Status:** IN PROGRESS; external checks AWAITING INPUT.  
**Owner:** developer; instructor/business owner supplies inputs.

- [x] Check section 3 readiness; record owners and missing items in [the Phase 0 report](./docs/PHASE-0-STATUS.md).
- [x] Create application/repository, dependency lockfile, formatter, lint, typecheck, environment template and setup instructions.
- [x] Provision staging database/auth foundation and apply initial migration; connection and schema verification passed. Complete sign-in flows remain Phase 2 work.
- [ ] Confirm sandbox Cashfree order creation and reachable webhook endpoint.
- [ ] Play one processed DRM test lesson on target desktop/mobile browsers with a server-generated token.
- [ ] Verify Resend domain/email path and Google callback configuration.
- [x] Record implementation versions, owner-unconfirmed budget assumptions and exact launch criteria in [the report](./docs/PHASE-0-STATUS.md) and [setup guide](./docs/SETUP.md).

**Exit gate:** a developer can run the app from setup instructions and demonstrate provider connectivity without exposing keys. Any failed provider spike becomes an explicit launch blocker immediately.

**Execution evidence:** local lint, typecheck, 10 tests, formatting, build and HTTP/browser checks passed. `npm run db:migrate -- --apply` committed the staging migration. `npm run db:verify` passed the migration checksum, 12 RLS-protected tables, policies, restricted grants, both triggers and default settings. Cashfree, DRM, email and Google integration acceptance remains pending. Vercel staging project is created and linked, with sandbox defaults only.

### Phase 1: Design system and public storefront

**Estimate:** 7–10 hours. **Status:** IN PROGRESS; storefront implementation verified, owner content AWAITING INPUT. **Depends on:** Phase 0 foundation.

- [x] Implement proposed identity, tokens and typography; record responsive layouts and future checkout/player/admin wireframes in [DESIGN.md](./DESIGN.md).
- [x] Build shared header/footer, buttons, search/filter inputs, theme switch, accessible dialogs and loading/error/empty states.
- [x] Produce original course covers and conceptual hero artwork; create an 8-second silent ambient video with responsive/reduced-motion fallback.
- [ ] Obtain and publish approved instructor photography, biography and actual lesson trailers; these have not been supplied.
- [x] Implement homepage, catalogue, three course-detail previews, approach/contact and all draft legal/disclaimer pages.
- [x] Show illustrative curriculum, durations, preview labels, level, Hindi tag and honest unconfirmed-tax wording.
- [ ] Replace illustrative catalogue/prices with real owner-approved content; wire authenticated ownership-aware CTAs after Phase 2.
- [x] Implement mobile purchase bar (disabled until checkout integration), mobile access/refund summary and usable keyboard navigation.
- [x] Add page metadata, social previews, sitemap, canonical URLs, robots rules and no-index staging/private areas.
- [ ] Obtain owner approval of facts, pricing, policies and images; omit unsupported testimonials/counts.

**Exit gate:** public pages work at 360px, 390px, 768px and 1440px, in both themes, with real course information and working navigation. Main CTA is visible without waiting for video. Content approval is tracked separately from a working UI.

**Verification:** 48 route/viewport/theme combinations, catalogue controls, dialogs, navigation, theme persistence, real ambient playback/manual-pause preservation and mobile media fallback pass. Existing 10 tests, lint, typecheck, formatting, build and HTTP checks pass. Targeted course-page Axe audits report no violations. Independent finish review passed after three focused fixes. Mobile Lighthouse: performance 92, accessibility 100, best practices 96; LCP 3.1s and CLS 0.002. These are local lab results, not field guarantees. Real content, contact/social links and policy approval remain outstanding; the full Phase 1 exit gate is not marked complete. See [Phase 1 report](./docs/PHASE-1-STATUS.md).

### Phase 2: Authentication, roles and two-device access

**Estimate:** 6–10 hours. **Status:** IN PROGRESS. **Depends on:** Phase 0.

- [x] Implement email/password signup and verification; exercise actual provider-generated signup/recovery verifiers without requiring inbox delivery in the test fixture.
- [x] Implement Google PKCE/callback and document verified same-email linking rules; disable UI when provider is unavailable.
- [ ] Complete a real Google consent/callback and same-email linking journey; provider enablement and app PKCE initiation now pass.
- [x] Implement Resend verification/reset/invitation delivery and atomic single-use 30-minute links; ten-minute recovery-only password grants tested.
- [ ] Verify delivered signup/reset/invitation messages in the real inbox. Operator transport now reports delivered using the testing sender; general student recipients require a verified business sender.
- [x] Implement password change, remember-me behavior, HttpOnly/SameSite cookies (Secure on HTTPS), logout and logout-all-devices; verify browser cookie behavior locally.
- [x] Add shared durable login/reset rate limits and generic email responses; login throttling tested.
- [x] Enforce at most two active devices atomically, including simultaneous login attempts and owned-device replacement.
- [x] Prevent pending third devices from reading private account/order data through both app APIs and direct Supabase REST.
- [x] Show device name, activity and revoke controls; enforce expiry/provider session validity and immediate protected-endpoint revocation.
- [x] Validate and preserve internal course/checkout return paths and reject open redirects; actual checkout interaction is Phase 3 and Google consent is pending.
- [x] Implement and test Admin/Support permissions, separate login, actual TOTP/AAL2 and staff removal. Invitation code is implemented; delivered invitation acceptance remains in the email gate above.

**Evidence:** [Phase 2 implementation, tests, acceptance gaps and operator runbook](./docs/PHASE-2-STATUS.md). Local HTTP cookie checks do not substitute for deployed HTTPS acceptance in Phase 6.

**Exit gate:** login, reset and email verification work with real delivered emails; third-device admission cannot bypass the limit. Revoked users/sessions lose protected access. Student and Support direct API calls cannot gain Admin permissions.

### Phase 3: Cashfree orders, GST, receipts and coupons

**Estimate:** 10–15 hours. **Status:** IN PROGRESS — local sandbox commerce implementation delivered; actual provider, GST and coupon gates open. **Depends on:** course data, Phase 2. See [Phase 3 status](./docs/PHASE-3-STATUS.md).

- [x] Build authenticated sandbox checkout and server-side course price/ownership validation; local guard/SQL tests pass.
- [x] Snapshot order price, tax settings, course, refund policy and supplied billing details; immutability tested locally. Final GST classification/inputs still require owner/accountant approval.
- [ ] Apply fixed/percentage coupons with scope, expiry, total/per-user limits and atomic usage accounting.
- [ ] Compute discount first, then GST on the applicable taxable amount, with documented rounding. Confirm final invoice treatment with the accountant.
- [x] Implement sandbox server order creation with stable retry keys and atomic pending-order reuse. Actual provider/multi-connection acceptance remains the exit gate.
- [x] Verify raw-body signatures and API-confirmed order/customer/amount/currency/success mapping; tested locally with controlled provider responses.
- [x] Persist minimal event references and idempotently settle payment/enrollment/billing/email in one SQL transaction; rollback tested.
- [x] Implement pending/closed/success states and failed-attempt retry semantics; local React and contract tests pass.
- [x] Prevent later failure events from downgrading or refund events from reactivating confirmed purchases; isolated SQL tests pass.
- [x] Implement durable delayed-event/abandoned-redirect reconciliation and protected scheduler integration; hosted scheduling/alerts still pending.
- [x] Generate private sandbox billing PDF/HTML snapshots and confirmed-refund credit notes; ownership and Hindi rendering tested. Production GST invoices are not accepted and GST-enabled checkout remains gated.
- [x] Queue purchase/refund emails independently with bounded retries and stale-claim protection; real inbox delivery and scheduling remain external acceptance.

**Exit gate:** sandbox payment succeeds once, one enrollment is created, and duplicate events do not double-grant access or duplicate receipts. A forged redirect/signature cannot unlock content. Existing ownership shows Go to course.

**Calculation fixture:** base INR 1,000, INR 100 coupon, taxable base INR 900, 18% GST INR 162, total INR 1,062. With GST off, total INR 900. Past orders keep the original snapshots after settings change.

[Cashfree's idempotency guidance](https://www.cashfree.com/docs/payments/online/webhooks/webhook-indempotency) documents multiple attempts per order and unique payment IDs. Use both payment-level and order-level protections. A client redirect is never purchase authority.

### Phase 4: Protected player, progress and student area

**Estimate:** 9-14 hours. **Status:** IN PROGRESS: core implementation delivered; DRM/browser acceptance pending. **Depends on:** Phase 2 and encoded videos. Phase 3 purchase acceptance is deferred.

- [x] Authorise every playback-token request using active session, admitted device, user state, published lesson and current entitlement or preview permission.
- [x] Generate short-lived VdoCipher playback tokens on the backend; apply a per-viewer dynamic watermark and provider restrictions.
- [x] Disable paid-video download/offline options and expose no plain course MP4 sources.
- [x] Implement responsive module/lesson navigation, locked/public-preview states, resume, explicit 0.5x to 2x speed selection and keyboard controls. Provider quality UI is integrated; actual browser playback/quality acceptance remains below.
- [x] Implement next lesson, independent completion and optional auto-next playback; verify actual autoplay, speeds and optional PiP behavior in supported browsers before sign-off.
- [x] Persist resume and progress server-side; provide loading, expired-token, unsupported-browser and playback-error recovery.
- [x] Collect validated playback heartbeats and merge watched intervals to calculate refund consumption without counting seeks or repeated ranges twice.
- [x] Implement My courses, continue watching, browse, private order history, honest snapshot-dependent eligibility states and links to existing profile/device controls.
- [ ] Finish real purchase/receipt flow with Phase 3 and refund submission/processing with Phase 5.
- [ ] Verify real DRM playback, moving email watermark, controls/resume/auto-next and revocation windows on supported desktop and physical mobile browsers. Isolated headless Chrome reported Widevine unavailable.
- [x] Render authorised lesson notes and text worksheets in the browser without public download URLs. Binary/PDF viewer support requires a separate content/storage decision.
- [x] Implement validated public community links and time-limited private invite eligibility for qualifying paid students. Actual official URLs and provider-side expiry remain owner configuration.

**Evidence:** [Phase 4 implementation and acceptance report](./docs/PHASE-4-STATUS.md). Synthetic orders/grants were used only in disposable test fixtures; no Cashfree transaction or permanent demo enrollment was created.

**Exit gate: NOT YET PASSED:** an unauthorised account cannot request a paid token; a buyer can watch, leave and resume. Watched consumption persists across devices and cannot be reset by changing local storage. Verify playback on physical Android Chrome and iPhone Safari where available.

[VdoCipher's OTP documentation](https://www.vdocipher.com/docs/server/playbackauth/otp/) requires token generation on the backend. DRM and watermarking reduce piracy but cannot guarantee that a screen is never recorded. Disabling right-click is cosmetic; browser-rendered notes can also be copied or photographed. Token expiry does not necessarily terminate an already-running stream: test provider revocation behavior and document the remaining access window after refund/session revocation.

### Phase 5: Refunds, admin operations and content management

**Estimate:** 12–18 hours. **Status:** IN PROGRESS. **Depends on:** Phases 2–4; Cashfree processing remains deferred.

- [x] Compute eligibility on the server from purchase time, purchased policy snapshot and validated per-order watched duration; SQL boundary tests pass.
- [ ] Show days/time remaining, watched percentage, reason field and clear ineligibility explanation.
- [ ] Build refund request/review queue and approval/rejection notes; snapshot eligibility evidence when requested.
- [x] Recheck frozen policy and watched data at review; preserve request-time evidence and record Admin-only goodwill exceptions. SQL tests pass; browser acceptance pending.
- [ ] Trigger Cashfree refunds with a unique refund reference, duplicate-click protection and retries that do not create a second refund.
- [ ] Distinguish requested, approved, provider-processing, rejected, failed and confirmed-refunded states. API acceptance alone is not final settlement.
- [ ] Revoke the refunded purchase's entitlement on confirmed refund; define any earlier temporary suspension explicitly and restore it on provider failure.
- [x] Preserve other valid purchases/manual grants after verified settlement and open a community-removal task only when no paid eligibility remains; SQL fixture tests pass.
- [ ] Send refund status emails and create an admin task for actual Telegram member removal. Verify that task is completed, not just the link hidden.
- [ ] Build admin overview with gross/net revenue, paid sales, refunds, refund rate, time filters, chart and course breakdown; exclude failed/pending payments from revenue.
- [ ] Implement searchable/filterable orders, order details, invoice resend, safe CSV export and payment reconciliation.
- [ ] Implement student search/detail, progress/devices, manual grants/revocation, blocking and force logout.
- [ ] Implement draft/publish course builder, ordered modules/lessons, provider upload/processing status and publish-time validation.
- [ ] Implement coupon management, FAQs/testimonials/content editor and community/tax/refund/device settings.
- [ ] Implement staff management, privileged MFA and append-only audit events for refunds, grants, settings, content and staff changes.
- [x] Enforce Support restrictions on server endpoints: no course/price/settings/staff/coupon/block/export changes; role/MFA and SQL tests pass. Browser direct-call regression remains to run.

**Evidence:** [Phase 5 implementation and acceptance report](./docs/PHASE-5-STATUS.md). Migration 005 is applied; five checksums and 26 RLS-protected tables verify. The last completed automated suite had 20 passes. Final Admin browser and newly added boundary assertions are awaiting execution; do not mark the phase exit gate passed yet.

**Exit gate:** a refund is processed exactly once, final failure is recoverable, access changes follow the recorded state and every privileged action has an actor/time record. A fourth course can be drafted, populated and published without code changes.

**Refund boundary contract:** eligible when server time is strictly before `paid_at + 7 days` and watched fraction is strictly below `0.10`. Exactly 10% watched or exactly the seven-day boundary is ineligible under this proposed precise interpretation. Display friendly IST times; have the owner approve this wording. Exclude public preview viewing from paid-course consumption. Version/snapshot published course duration and policy so later edits cannot retroactively change a purchase's eligibility. Admin goodwill overrides require an explicit note and audit entry.

### Phase 6: Verification, deployment and handover

**Estimate:** 6–9 hours. **Status:** IN PROGRESS — local verification and handover delivered, external launch gates open. **Depends on:** all launch-critical functionality. Current evidence: [Phase 6 status](./docs/PHASE-6-STATUS.md).

- [x] Run lint, type checks, production build and targeted automated tests for money, access and refund rules. Fresh local checks pass, including 35 Node and 10 React tests.
- [ ] Complete the critical end-to-end tests in section 11 on an isolated staging dataset.
- [x] Check public mobile and desktop layouts, both themes, form validation, keyboard focus and reduced-motion behavior. 32 production-browser tests cover 48 route/theme checks and 16 Axe audits. Authenticated hosted/player acceptance remains below.
- [x] Measure performance on a production build with a defined mobile/4G profile; record the actual report. Lighthouse 13.6.0: 100 performance/100 accessibility, LCP 1064ms, CLS 0.0039, TBT 64ms, 312936 transfer bytes; local synthetic catalogue, not hosted/field acceptance.
- [ ] Validate social previews, public indexing, legal links and authentication of invoice URLs.
- [ ] Configure production secrets, real webhooks, DNS, HTTPS, production redirects and preview isolation.
- [ ] Enable database backups, verify a restore procedure, monitoring, alerts, reconciliation and durable email retries.
- [ ] Run an owner-authorised low-value live payment/refund smoke test if providers are approved. Keep sandbox and live records separate.
- [x] Complete all launch gates, or disable real checkout and document remaining blockers. Real checkout remains disabled and the current blockers are recorded in the Phase 6 report.
- [x] Provide administrator onboarding, operational runbook, environment/setup documentation, known issues and this updated status file. See [operational runbook](./docs/OPERATIONS-RUNBOOK.md) and [environment template](./.env.example). Owner access and hosted handover acceptance are still required by the exit gate.

**Exit gate:** owner can review the deployed release, real course content and acceptance evidence. A successful build alone does not mean ready to sell.

## 8. Tomorrow's delivery sequence

The following is a timebox for a single developer, measured from implementation kickoff. It is intentionally narrower than the full 52–79-hour scope. Reassess after the integration spikes; do not label a partial build production-ready.

| Timebox | Focus | Reviewable output |
|---|---|---|
| First 0–2 hours | Readiness checks, scaffold, migrations and provider spikes | Running staging foundation and a blocker list |
| Hours 2–5 | Tokens, home/course design and responsive storefront | Distinctive public preview with course data and media fallback |
| Hours 5–9 | Auth and one server-verified sandbox purchase | Login → checkout → verified order → enrollment |
| Hours 9–12 | One DRM lesson and student resume flow | Purchased lesson playback and persistent progress |
| Hours 12–15 | Refund/access/roles spine and essential admin views | Reviewable critical operations; precise incomplete-feature list |
| Final 2 hours before handover | Stop feature expansion, verify, fix and update tracker | Tested release candidate and go/no-go decision |

This assumes approximately 17 focused hours remain available before handover; actual available time is unconfirmed. If less time remains, shrink the preview scope and document it. Content delivery, provider failures and integration surprises can consume the timebox. An absent launch gate means the site stays in staging even if the storefront looks complete.

**Protect first:** server-verified payments, correct tax totals, durable entitlements, authorisation, verified DRM, correct refund handling and honest content.

**Simplifications to propose if needed:** poster instead of decorative video until licensed footage arrives; CSV before native Excel; summary KPIs before advanced charts; managed video-host upload with IDs before fully integrated upload; basic content forms before rich editors. Each affected original requirement remains incomplete until implemented or the owner explicitly accepts the changed scope.

## 9. Later releases and scope conflicts

The original document puts coupons, tax PDFs, activity logs and admin 2FA in Phase 2 while also requiring them elsewhere. Resolve those conflicts visibly:

| Requirement | Proposed treatment |
|---|---|
| Audit log, server roles, privileged MFA | Launch requirement because staff can issue refunds and change access |
| GST invoice/receipt generation and purchase email | Launch requirement when applicable; attractive PDF layout can follow, but required billing evidence cannot |
| Coupons | Implement in Phase 3; if omitted tomorrow, explicitly record the requirement as incomplete |
| FAQ/testimonial editor | Implement in Phase 5; owner-approved static copy is only a proposed temporary fallback |
| Reviews and ratings | Genuine existing feedback may be displayed with approval; new student submission/moderation can follow |
| Analytics | Essential privacy-aware funnel events at launch where feasible; Meta Pixel/advanced dashboards after tracking review |

**Post-launch release 1:** improved reporting, native Excel if needed, richer content editing, refined invoice presentation and consent-aware marketing analytics. Recheck any incomplete original launch items first.

**Post-launch release 2:** completion certificates, lesson Q&A/moderation, student review submission, opt-in announcements, unfinished-course reminders and Telegram bot membership automation.

**Future discovery:** bundles, live classes, referral/affiliate system and a mobile app. These need separate requirements, effort estimates and budget approval; they are not hidden inside tomorrow's commitment.

## 10. Coverage of the source requirements

| Source section | Implementation location | Completion condition |
|---|---|---|
| 1. Overview/decisions | All phases | Core decisions preserved; delivery date override recorded |
| 2. User roles | Phases 2 and 5 | Server-enforced Student/Admin/Support access matrix |
| 3. Public site | Phase 1 | Real course information, previews and approved legal pages |
| 4. Authentication | Phase 2 | Verification/reset/Google/device-limit tests pass |
| 5. Purchases/payments | Phase 3 | Cashfree, GST snapshots, coupons, invoices and all payment states verified |
| 6. Course player | Phase 4 | Protected streaming, watermark, resume/progress and supported controls verified |
| 7. Student dashboard | Phase 4; refund flow Phase 5 | Owned courses, orders, eligibility, profile and community verified |
| 8. Refunds | Phase 5 | Boundary rules, provider processing, revocation, emails and member removal verified |
| 9. Admin | Phase 5 | Dashboard, orders/export/reconciliation, students, builder, content, settings, staff and audit working |
| 10. UI/UX | Phases 1, 4 and 6 | Responsive, accessible, consistent themes and measured performance |
| 11. Emails | Phases 2, 3 and 5 | Delivered auth, purchase, failure and refund emails with safe retries |
| 12. Non-functional | Phases 0, 2, 3 and 6 | Security, backup/restore, monitoring, capacity, SEO and tracking reviewed |
| 13. Stack | Phase 0; section 6 | Stable versions pinned and provider limitations verified |
| 14. Original phases | Sections 7–9 | Conflicting placements resolved without silently deleting requirements |
| 15. Open questions | Section 3 | Hours, GST/billing, budget and readiness confirmed |

## 11. Verification matrix

Use meaningful automated tests for financial, role and entitlement logic, plus browser testing for actual purchase/playback journeys. Do not count mocked provider responses as a successful live integration.

| Test | Expected outcome | Status |
|---|---|---|
| Sign-up, verification, login, Google, reset and password change | Real emails/callbacks work; reset is single-use and expires | PARTIAL: live password/token/reset tests pass; operator email delivered in testing mode and Google enabled; real Google consent and general-recipient email acceptance pending |
| Third device and concurrent logins | Device selection required; atomic two-device limit; no paid access before admission | PASS for private account/order APIs and direct REST; paid playback still Phase 4 |
| Logout-all/block/revoke | Protected APIs deny immediately; existing playback limitation measured | PASS for session revocation in app and REST; blocked-profile logic in guards/SQL; player not implemented |
| Login from Buy now | Returns to the same course checkout using a safe internal URL | Safe path tests PASS; live checkout remains Phase 3 |
| Invalid/expired coupon and concurrent last-use redemption | Server rejects invalid codes and prevents exceeding the usage limit | NOT RUN |
| GST on/off, discount, rounding, later setting edits | Exact server totals; historical invoices unchanged | NOT RUN |
| Forged redirect, tampered total and invalid webhook | No enrollment or paid state | PASS locally for safe redirects, demo HMAC/schema/amount checks and atomic grant. Cashfree settlement acceptance open |
| Duplicate/out-of-order events and late SUCCESS after FAILED | Exactly one paid enrollment; paid order never downgraded | PASS for isolated demo SQL terminal/idempotency tests; Cashfree retry/reconciliation open |
| Browser closes after payment; webhook delayed | Reconciliation resolves status without charging twice | NOT RUN |
| Email fails after purchase | Course stays unlocked; email retries safely | PASS locally for atomic purchase outbox and independent sender/backoff/claim/idempotency-window guards; actual inbox acceptance open |
| Non-buyer, revoked buyer and preview lesson | Only authorised content receives playback tokens | PASS for live staging authorisation/token tests; actual DRM/browser acceptance remains open |
| Seek/replay/2x playback/multiple tabs | Watch consumption counts validated unique content time and is capped | PASS for SQL watch ledger and lease replacement; actual DRM telemetry acceptance pending |
| Refund at 9.99%, 10%, before/at seven days | Boundary behavior matches approved policy | PASS locally for exact policy/SQL boundaries; business wording approval and provider acceptance open |
| Duplicate refund approval; provider timeout/failure | No double refund; explicit processing/retry/failure state | PARTIAL: local review/settlement idempotency and failure tests pass; real provider dispatch/timeout acceptance open |
| Multiple purchases and one refunded course | Other entitlements remain; community eligibility recalculated correctly | NOT RUN |
| Support direct endpoint calls | Cannot alter prices, content, settings, staff or other Admin-only resources | Staff API role/MFA boundary PASS; future business endpoints need Phase 5 tests |
| Add fourth course and unpublished lesson | No code change needed; drafts are not publicly accessible | NOT RUN |
| Invoice access and CSV injection | Orders are private; exported spreadsheet formulas are neutralised | PASS locally for private billing authorization, PDF/escaped HTML and CSV injection. Approved production tax invoice details and hosted acceptance remain open |
| Reduced motion, video failure, touch, keyboard and both themes | All core flows usable without decorative motion | PASS for public Chromium matrix; authenticated hosted flows and actual DRM remain open |
| Production build and performance | Build passes; actual reports recorded, not assumed | PASS locally, 31 Oct: build and defined mobile/4G Lighthouse; hosted/field acceptance open. See Phase 6 report |
| Launch spike and restore drill | Declared target load handled; database restore procedure demonstrated | NOT RUN |

**Performance acceptance:** preserve the requested under-two-second landing experience as a measured target on an agreed representative 4G profile. Record Lighthouse mobile score (target at least 90), LCP (target at most 2 seconds for the requested experience), CLS (at most 0.1), transfer sizes and environment. Evaluate INP from representative interaction testing and field data when available (target at most 200 ms). Do not claim one lab score guarantees all devices or networks. Load-test an agreed target, initially 200 concurrent browsing sessions and a smaller realistic sandbox checkout burst, within provider limits.

**Refund tracking limitation:** playback telemetry can be hardened but cannot prove human attention. Validate elapsed time, speed, ranges, sequence and concurrent sessions on the server; reject impossible jumps and never trust a single client-supplied watched percentage.

## 12. Go-live gates

Every gate must have evidence. None is currently passed.

- [ ] Correct real course content, duration, price, instructor identity, media licences and approved policies are published.
- [ ] Cashfree live account is approved and production webhook signatures, retries and reconciliation are verified.
- [ ] An authorised live purchase and refund exercise succeeds with correct records and entitlement changes.
- [ ] DRM, watermarking, protected token generation and actual target-browser playback are verified.
- [ ] Email verification, password recovery and mandatory purchase/refund emails deliver reliably.
- [ ] Tax configuration and invoices/receipts match owner/accountant-approved requirements.
- [ ] Two-device control, ownership checks, Admin/Support boundaries, MFA and audit trails pass.
- [ ] Refund rules, provider states and access revocation work without double-processing.
- [ ] No critical checkout/player failures, exposed secrets or unresolved authorisation defects remain.
- [ ] Production domain/HTTPS, backups/restore, monitoring, alert destinations and operational ownership are ready.
- [ ] Mobile usability, accessibility and agreed performance targets have recorded results or explicit owner-accepted noncritical exceptions.
- [ ] Owner receives working access, runbook, known issues and a final scope/status review.

**No-go behavior:** keep real checkout disabled and the preview clearly in staging. Do not replace secure streaming with public course files or bypass webhook verification to meet the date. Deliver the working review URL, failed gates, responsible owners and next achievable release checkpoint.

## 13. Blocker register

Missing information is marked unverified until confirmed. It is not evidence that the owner lacks an account.

| ID | Issue | Owner | Status | Next action / review |
|---|---|---|---|---|
| B01 | Deadline advanced from original schedule; full scope exceeds a reliable one-day estimate | Developer + owner | OPEN | Review exact available hours and delivery boundary at kickoff |
| B02 | Cashfree live/KYC status unknown | Business owner | UNVERIFIED | Confirm immediately; live sales gate |
| B03 | Video readiness, durations, DRM account and encoding unknown | Instructor + developer | UNVERIFIED | Upload early; prove one lesson before broad build-out |
| B04 | Final instructor/course/business/support content unknown | Business owner | AWAITING INPUT | Supply minimum real launch content before public release |
| B05 | Tax, legal review, domain and sender readiness unknown | Business owner + accountant | UNVERIFIED | Confirm production configuration before enabling purchases |
| B06 | Budget and service capacity not agreed | Business owner | AWAITING INPUT | Record expected launch traffic, video hours and spending limits |
| B07 | Remaining payment/video provider credentials and acceptance | Business owner + developer | AWAITING INPUT | Supabase and email values are present and database migrations verified. Cashfree values remain pending. VdoCipher credentials now issue a backend playback OTP successfully; actual playback/watermark acceptance remains pending. Email/Google acceptance is tracked separately below |
| B08 | Direct Supabase database endpoint required unavailable IPv6 | Business owner + developer | RESOLVED | Session pooler connection verified; staging migration committed and schema checks passed |
| B09 | General-recipient Resend sender verification | Business owner | PARTIALLY RESOLVED | Operator test now delivered with testing sender; verify a business domain before emailing students and finish real auth email acceptance |
| B10 | Google browser consent/callback acceptance | Business owner + developer | PARTIALLY RESOLVED | Provider is enabled; app PKCE initiation returns 200. Complete real sign-in/callback and same-email behavior |
| B11 | Fresh staging schema acceptance fails | Database owner + developer | OPEN | Initial read-only recheck failed migration ledger matching; strict TLS now requires trusted Supabase CA. Restore trust, inspect drift and verify without reapplying migrations blindly |
| B12 | Saved Vercel staging project unavailable to current credentials | Hosting owner + developer | OPEN | Connector returns 404 for saved name and project ID in saved team; CLI has no credentials. Restore exact target access before deployment |

## 14. Skill guidance

No new skill installation or custom skill file is needed to produce this plan. The existing [design-taste-frontend skill](../../.agents/skills/design-taste-frontend/SKILL.md) informed the public-site design direction. This planning task does not require creating imagery or building the website yet.

For implementation, use available frontend-quality, authentication, deployment and end-to-end verification guidance when the relevant work starts. A project-specific skill is useful only if there are repeatable house rules beyond this plan. Ask the owner only when such missing rules materially affect the result; do not make installing more skills a launch dependency.

## 15. Handover and change log

### Latest handover state

**31 October update:** [Phase 6 verification and handover](./docs/PHASE-6-STATUS.md) is the current acceptance record. Local quality gates pass; new browser/accessibility/404 fixes, safe operator tooling and notification lease protection are delivered. Shared staging, hosted deployment and live commerce/DRM/content gates remain open. [The runbook](./docs/OPERATIONS-RUNBOOK.md) records the next steps and operational ownership.

- **Delivered:** Phase 0 foundation/staging schema, Phase 1 storefront, Phase 2 account/security and Phase 4 library/classroom with protected provider integration, persistent progress and unique watch ranges. Full DRM/browser and real-content acceptance remains open.
- **Website preview URL:** <http://localhost:3000> while the production preview task runs; no hosted deployment verified.
- **Website features implemented:** storefront/catalogue/previews, theme/menu/dialog/risk controls, updated draft policies, signup/login/recovery/profile/devices, atomic device admission and revocation, staff MFA/roles/management, Google callback, Resend link transport and durable auth limits. Enrolment remains disabled.
- **Tests run:** lint/typecheck/format, 18 automated SQL/security tests, production build, four-migration/18-table remote verification, live staging auth and learning access/progress checks, 12 learning layout/Axe combinations and 48 storefront checks pass. The SDK contract simulation saved real server progress and exercised auto-next. Actual DRM remains unverified due to unavailable Widevine in isolated browser profiles. Disposable test records cleaned up. Earlier landing Lighthouse: 99 performance/100 accessibility, LCP 0.9s (local lab only).
- **Next milestone:** authorised staging migration 009 and actual sandbox purchase/refund/billing/email acceptance after restoring trust/ledger and hosting access. Local commerce implementation has resumed and is delivered; supported-browser DRM, approved content/tax data and production enablement remain open.
- **Live-sales decision:** not ready; launch gates remain open.

### Change log

| Date | Change | Evidence |
|---|---|---|
| 29 Oct 2026 | Read source requirements and inspected workspace | Requirements-only starting state |
| 29 Oct 2026 | Reviewed Varsity, Elearnmarkets, FinGrad, historical SEBI research, Cashfree, VdoCipher and web.dev | Source links embedded in relevant sections |
| 29 Oct 2026 | Created phase plan and tracker; documented tomorrow's deadline and launch safeguards | This document; no implementation claimed |
| 29 Oct 2026 | Implemented and verified local Phase 0 foundation; created/linked dedicated Vercel staging project | [Phase 0 report](./docs/PHASE-0-STATUS.md); external acceptance remains awaiting configuration |
| 29 Oct 2026 | Adopted requested single-package layered monolith with frontend/backend folders | [Architecture](./docs/ARCHITECTURE.md); migration moved into backend/database with identical checksum |
| 29 Oct 2026 | Simplified folder layout: root app routing and backend utility scripts | [Architecture](./docs/ARCHITECTURE.md); removed redundant source/root script folders and updated commands/imports |
| 29 Oct 2026 | Attempted staging database connection; Auth API reachable, direct PostgreSQL blocked by IPv6 networking | [Phase 0 report](./docs/PHASE-0-STATUS.md); no remote migration applied; session-pooler URL required |
| 29 Oct 2026 | Applied and verified staging migration after switching to Session pooler | Migration committed; checksum, 12 RLS tables, policies, grants, triggers and defaults pass |
| 29 Oct 2026 | Implemented and verified Phase 1 public storefront preview; owner content acceptance pending | [Phase 1 report](./docs/PHASE-1-STATUS.md); 48 responsive checks, targeted Axe and independent focused review pass |
| 29 Oct 2026 | Removed hero media gradient at owner request and separated desktop text/media for contrast | [Phase 1 report](./docs/PHASE-1-STATUS.md) |
| 29 Oct 2026 | Removed hero image and matching ambient video at owner request; adjusted text-led hero spacing | [Phase 1 report](./docs/PHASE-1-STATUS.md); build and lint pass |
| 29 Oct 2026 | Redesigned landing page using the newly added SaaS Product UI System skill | Warm charcoal/sage scoped system, course-path hero, refined cards and 48 responsive checks plus homepage/course accessibility audits pass; no removed media restored |
| 29 Oct 2026 | Measured redesigned landing page in local mobile Lighthouse | Performance 99, accessibility 100, LCP 0.9s, CLS 0.002, TBT 110ms; lab results only |
| 29 Oct 2026 | Implemented Phase 2 accounts, atomic two-device admission, admitted-session RLS, password recovery, staff MFA/roles and audit controls; applied migrations 002/003 | [Phase 2 report](./docs/PHASE-2-STATUS.md); live staging tests pass with disposable fixture cleanup; email transport 403 and Google disabled remain open |

### Next status update template

```text
Updated at (IST):
Active phase and owner:
Completed task IDs / checkboxes:
Evidence (code, migration, test result or preview):
Current blocker, owner and next action:
Remaining original launch requirements:
Next milestone and forecast:
Live-sales readiness / failed gates:
```

### Provider recheck: 29 October 2026

Google provider enablement and application PKCE initiation now pass. The operator Resend message was accepted and reported delivered using the testing sender. Previous disabled-provider and HTTP 403 findings are superseded for these checks. Full Phase 2 acceptance still requires Google consent/callback, verified business-domain sending to general recipients and delivered authentication email journeys.

### UI palette update: 30 October 2026

Applied the owner-requested institutional palette: obsidian #0B0E11, slate #1E222D, electric-blue actions #2962FF and off-white #F0F3FA. Shared tokens cover landing, catalogue, auth and staff screens; light mode uses coordinated cool neutrals. Secondary copy is brightened for contrast. No payment or learning features are added by this visual revision.

### VdoCipher connection verification: 30 October 2026

The configured API secret and test video ID successfully issued backend OTP/playback credentials. Private short-lived playback HTML was written only to ignored operator artifacts. The provider probe reports PARTIAL intentionally: browser DRM playback, watermark, device support and protected application integration remain Phase 4 acceptance work. Cashfree setup is deferred by the owner.

### Phase 4 implementation: 30 October 2026

Delivered student library/classroom, protected VdoCipher integration, server resume/completion and bounded unique watch ranges, browser notes, private order/eligibility states and community access checks. Applied migration 004; four migration checksums and 18 RLS tables verified. Eighteen automated tests and live staging access/progress/layout checks pass. Actual DRM playback remains unconfirmed: isolated automated Chrome reports Widevine unavailable. See [Phase 4 report](./docs/PHASE-4-STATUS.md). Cashfree and Phase 3 remain deferred; live sales are disabled.
