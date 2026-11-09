# Website speed and smoothness: implementation checklist

Date: 8 November 2026\
Reference commit: `272990e`, plus existing uncommitted order-detail/component styles\
Status: Phases 0-1 complete; Phases 2-3 code/non-browser verification complete, browser acceptance delegated to the user, 9 November 2026\
Scope: preserve every existing feature, function, animation, responsive layout, and theme.

This plan turns the project-wide audit into implementation batches. It does not replace the older [launch implementation plan](../IMPLEMENTATION-PLAN.md). A checked item means the stated result has been verified, not just that code was written. Recheck source before each batch because the audit describes a point in time.

Implementation started from `77052e3`, preserving existing order-detail and shared-style edits. See [the first batch evidence and remaining gates](./PERFORMANCE-PHASE-0-1-RESULTS-2026-11-09.md). Unchecked tasks can be partially implemented; their complete acceptance conditions have not yet been verified.

Current acceptance: [Phase 0-1 closeout](./PERFORMANCE-PHASE-0-1-CLOSEOUT-2026-11-09.md) records 33 navigation samples, 12 production acceptance checks plus four rapid-switch mouse/touch checks, cache evidence, preservation inventory and route budgets. Checked Phase 0-1 items represent isolated local acceptance, not production/provider/physical-device acceptance. Those remain Phase 7. The new baseline is after Phase 1 core fixes and before Phase 2; no retroactive speed improvement is claimed.

## Non-negotiable boundaries

- Preserve all current animations, including the festival video, replay/skip controls, hero annotations, curved carousel, tickers, hover effects, celebrations, and order-detail expansion.
- Preserve public pages, authentication, device restrictions, MFA, student/admin/support permissions, checkout, payment reconciliation, refunds, receipts, learning, progress, notes, and video protection.
- Preserve current typography, artwork, branding, content, light/dark themes, and mobile/desktop behavior. Media compression must be visually reviewed; original assets remain recoverable until acceptance.
- Do not remove security checks to save a request. Do not publicly cache identity, orders, receipts, payment state, private links, or protected lesson data.
- Preserve historical order amounts, tax/discount snapshots, payment idempotency, and receipt deduplication.
- Do not replace the UI library, add an animation framework, upgrade dependencies, change payment providers, or redesign the website as part of this work.
- Existing uncommitted edits belong to the user. Record and preserve them before beginning implementation.
- Prepare and verify local changes first. Production deployment, shared-database migrations, and external-service configuration are separate execution steps; this plan does not authorize them.
- Skill advice to delete motion, simplify away a feature, weaken security, or perform a redesign is overridden by the preservation requirements above. Accordion expansion that moves following rows may require layout; do not replace it with an overlay to obtain compositor-only animation.

## Order and dependencies

| Phase | Purpose                                          | Start after                                    | Main skills                                                                            |
| ----- | ------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| 0     | Establish baseline and preservation checklist    | Now, when implementation is authorized         | `gravitas`, `vercel:verification`                                                      |
| 1     | Fix interaction failures and motion defects      | Phase 0                                        | `gravitas`, `make-interfaces-feel-better`, `animate` where needed, `review-animations` |
| 2     | Reduce media, image, and font delivery           | Phase 0; may run independently of Phase 1      | `gravitas`, `vercel:react-best-practices`, installed Next.js docs                      |
| 3     | Reduce repeated authentication and data fetching | Phases 0-1                                     | `gravitas`, `vercel:react-best-practices`, official `supabase` skill if installed      |
| 4     | Optimize SQL, reporting, and payment-side waits  | Phase 0; coordinate API contracts with Phase 3 | `gravitas`, official Supabase skills                                                   |
| 5     | Split bundles/styles and reduce rendering work   | Phases 1-3; stabilize data contracts first     | `vercel:react-best-practices`, `make-interfaces-feel-better`                           |
| 6     | Remove proven legacy/unused code                 | Active flows verified in earlier phases        | `gravitas`, `karpathy-guidelines`                                                      |
| 7     | Validate the complete result and prepare handoff | All implemented phases                         | `gravitas`, `vercel:verification`, `review-animations`                                 |

Use small, reviewable batches. Backend batching, payment changes, authentication, and CSS consolidation should not be combined into a single large change.

## Which skill to use, when, and for what

This is the execution guide for the checkbox IDs below. Load the relevant skill before its work begins, not every skill at once. Read any references required by that skill. Skill assignments do not mark a task complete and do not authorize implementation from this planning request.

### Always-on workflow for every implementation batch

1. **Before editing:** use `gravitas` to confirm the task IDs, current source, allowed files, preservation requirements, baseline, and completion evidence.
2. **While editing:** use `karpathy-guidelines` to keep the patch small, avoid unrelated refactoring, and preserve existing behavior. Add the specialist implementation skill from the tables below.
3. **After React changes:** use `vercel:react-best-practices` to review fetching, hooks, boundaries, rendering, and bundle implications. It can guide implementation too; it is not only a final lint step.
4. **After motion changes:** use `review-animations` to review the patch and inspect the browser interaction. Use `animate` or `make-interfaces-feel-better` for implementation, not `review-animations`.
5. **At a user-flow completion gate:** use `vercel:verification` to follow browser -> API -> data -> response -> visible result. Use `gravitas` to record actual checks, measurements, and unresolved limitations before ticking tasks.

`gravitas` and `karpathy-guidelines` apply throughout; the phase tables list additional skills or a specific use of that baseline workflow. Browser traces, Lighthouse, media encoders, and database query plans are verification/implementation tools, not skills.

### Phase 0 - Before any optimization

| Checkbox IDs | When and work                                                              | Skill to use                                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0.1-P0.2    | Establish the starting state, scope, and complete feature inventory.       | `gravitas` for evidence and scope; `vercel:verification` for mapping the actual user journeys.                                                                          |
| P0.3, P0.6   | Record before screenshots, motion clips, and interaction traces.           | `make-interfaces-feel-better` for visual consistency; `review-animations` for motion inspection only.                                                                   |
| P0.4-P0.5    | Measure production-build loading, requests, payloads, and cache scenarios. | `gravitas` for comparable measurement conditions; `vercel:react-best-practices` for interpreting waterfalls and initial bundles. Use existing browser/Lighthouse tools. |
| P0.7         | Separate existing failures from regressions and establish budgets.         | `gravitas`; record observed results rather than assumed health.                                                                                                         |

### Phase 1 - While fixing interactions and motion

| Checkbox IDs | When and work                                                                  | Skill to use                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1.1-P1.2    | Fix same-lesson loading, stale order responses, and pending callback cleanup.  | `vercel:react-best-practices` for state/effect/request lifecycle; `vercel:verification` afterward for rapid interaction sequences.                                                        |
| P1.3         | Implement reliable inline detail expansion/collapse and interruption.          | `animate` for transition lifecycle; `make-interfaces-feel-better` for clipping/spacing. Follow with `review-animations`; preserve current timing and row-pushing layout.                  |
| P1.4-P1.5    | Resolve competing carousel timing and the ticker loop discontinuity.           | `make-interfaces-feel-better` for the existing motion implementation; `review-animations` after the fix. Use `animate` only if a motion mechanism needs reconstruction, not a new effect. |
| P1.6-P1.7    | Preserve player focus visibility and make transition properties explicit.      | `make-interfaces-feel-better` for visual/interaction changes; `review-animations` for confirming feedback remains intact.                                                                 |
| P1.8         | Investigate costly blur, shadow, and masking before changing layers.           | `review-animations` for performance review; `make-interfaces-feel-better` only for a measured, appearance-preserving adjustment.                                                          |
| P1.9         | Improve filter loading feedback and hidden-tab polling lifecycle.              | `vercel:react-best-practices`; `vercel:verification` for hidden/resumed tab and payment-state behavior.                                                                                   |
| P1.10        | Verify interruption, accessibility modes, and the fixed interaction sequences. | `review-animations` for motion acceptance; `vercel:verification` for full interactions; `gravitas` for recorded evidence.                                                                 |

### Phase 2 - While optimizing delivery

| Checkbox IDs | When and work                                                                         | Skill to use                                                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2.1-P2.2    | Inspect/re-encode the existing video and verify delivery, autoplay, skip, and replay. | `gravitas` for measured asset changes; `vercel:verification` for playback/control behavior. No specialist encoding skill is installed: use suitable media tools, not `imagegen`, which is not a video compressor. |
| P2.3-P2.5    | Optimize active-theme logos and responsive thumbnail delivery.                        | `vercel:react-best-practices` plus installed Next.js image docs; `make-interfaces-feel-better` for visual fidelity. If upload/storage SQL changes, also load `supabase-postgres-best-practices` before SQL edits. |
| P2.6         | Adjust font loading/preload without changing typefaces or fallback geometry.          | `vercel:react-best-practices` plus installed Next.js font docs; `make-interfaces-feel-better` for typography and layout review.                                                                                   |
| P2.7         | Compare delivery bytes, media quality, theme switching, and layout stability.         | `vercel:verification` for the user flows; `gravitas` for before/after evidence.                                                                                                                                   |

### Phase 3 - Before and during authentication/data-fetching changes

| Checkbox IDs | When and work                                                                         | Skill to use                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| P3.1         | Trace proxy, server authorization, and client identity requests separately.           | `vercel:verification` for the request path; `vercel:react-best-practices` for detecting duplicate work.                                           |
| P3.2-P3.3    | Implement shared identity requests and explicit refresh/invalidation behavior.        | Official `supabase` skill for SSR/auth/session rules; `vercel:react-best-practices` for React state and request sharing.                          |
| P3.4         | Narrow public-static-asset proxy work without exempting protected routes.             | Official `supabase` skill for session integration, installed Next.js proxy/CSP docs, then `vercel:verification` for access and response behavior. |
| P3.5-P3.7    | Defer unrelated view data, deduplicate announcements, and preserve billing freshness. | `vercel:react-best-practices` for fetching and state; `vercel:verification` for deep links, tabs, and payment-return flows.                       |
| P3.8         | Combine admission verification and conditional activity touch, if justified.          | Official `supabase` skill; add `supabase-postgres-best-practices` before any RPC/function/migration change.                                       |
| P3.9         | Verify all roles, revocation, MFA, devices, logout, and account switching.            | `vercel:verification`; official `supabase` skill for reviewing auth correctness; `gravitas` for the completion gate.                              |

### Phase 4 - Before any SQL or payment-side optimization

| Checkbox IDs | When and work                                                                                       | Skill to use                                                                                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P4.1-P4.6    | Inspect query plans; optimize course/history/lesson reads, refund batching, and learner pagination. | `supabase-postgres-best-practices` before writing SQL; official `supabase` skill for RPC/data-access integration. Use `vercel:react-best-practices` when the pagination/API contract changes the UI.                                 |
| P4.7         | Decouple receipt transport using durable outbox claims, worker triggering, and retries.             | `supabase-postgres-best-practices` for database claims/concurrency and `gravitas` for payment/delivery invariants. Use official `supabase` if a Supabase-specific worker mechanism is selected; no new workflow platform is assumed. |
| P4.8         | Reuse the external gateway collector session and coordinate refresh.                                | `gravitas` for isolation and payment invariants; `karpathy-guidelines` for the narrow client change. Use the gateway's actual contract; the Supabase skill is not documentation for this separate gateway.                           |
| P4.9         | Evaluate indexes and region placement using measurements.                                           | `supabase-postgres-best-practices` for plans/indexes; official `supabase` for database-side configuration interpretation. A hosting change remains a separate execution step.                                                        |
| P4.10        | Prepare and verify versioned migrations and rollback notes.                                         | `supabase-postgres-best-practices` and official `supabase`; `gravitas` for scope and target-environment evidence.                                                                                                                    |
| P4.11        | Verify ownership, expiry, pagination, settlement, email retries, and refund calculations.           | `vercel:verification` for end-to-end flows; `supabase-postgres-best-practices` for database invariants/tests; `gravitas` for the recorded gate.                                                                                      |

### Phase 5 - While splitting bundles/styles and isolating renders

| Checkbox IDs | When and work                                                                           | Skill to use                                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P5.1-P5.2    | Inspect production chunks and selectively lazy-load/preload student panels.             | `vercel:react-best-practices` for boundaries, dynamic imports, and avoiding first-interaction waterfalls; `gravitas` for measured results.                                 |
| P5.3-P5.4    | Scope styles and consolidate duplicate rules without changing the cascade.              | `make-interfaces-feel-better` for visual preservation; `karpathy-guidelines` for surgical CSS edits; `vercel:react-best-practices` for route/component loading boundaries. |
| P5.5-P5.6    | Profile player rerenders, DRM attachment lifecycle, and serialized payload duplication. | `vercel:react-best-practices`; `vercel:verification` for playback/progress/notes and failure recovery.                                                                     |
| P5.7         | Check initial loading, first tab switch, later navigation, styling, and hydration.      | `vercel:verification`; `make-interfaces-feel-better` for appearance; `review-animations` where motion-bearing components changed.                                          |

### Phase 6 - Only after active-flow verification

| Checkbox IDs | When and work                                                                                                | Skill to use                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P6.1-P6.4    | Recheck reachability and remove only proven obsolete modules/exports.                                        | `gravitas` for evidence and feature preservation; `karpathy-guidelines` for narrowly scoped deletion. Use `vercel:react-best-practices` when checking bundler/component reachability. |
| P6.5         | Retire test-only legacy UI/helpers while keeping useful assertions on current flows.                         | `gravitas` and `karpathy-guidelines`; `vercel:verification` to verify the replacement production flows, not merely the old fixtures.                                                  |
| P6.6-P6.7    | Consolidate duplicate assets and exclusively obsolete CSS without breaking public URLs or dynamic selectors. | `karpathy-guidelines` and `make-interfaces-feel-better`; `gravitas` for reference checks and preservation evidence.                                                                   |

### Phase 7 - After implementation, before marking completion

| Checkbox IDs    | When and work                                                                                         | Skill to use                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P7.1-P7.2       | Run the relevant checks and production build, triaging regressions separately from baseline failures. | `gravitas`; add `vercel:react-best-practices` for final React-quality review.                                                                                   |
| P7.3            | Repeat matched performance measurements and compare results.                                          | `gravitas` for comparable evidence; `vercel:react-best-practices` for residual waterfall/bundle/render interpretation.                                          |
| P7.4, P7.6-P7.7 | Verify complete journeys, cache/privacy behavior, and available real-provider/DRM paths.              | `vercel:verification`; official `supabase` for auth/data isolation checks; `gravitas` for explicit unverified items.                                            |
| P7.5            | Accept visual and motion parity across themes, devices, and input modes.                              | `make-interfaces-feel-better` and `review-animations`; use browser screenshots, clips, and traces rather than source review alone.                              |
| P7.8-P7.9       | Prepare the handoff/rollback record and review real-user metrics after an authorized release.         | `gravitas` for measured reporting and limitations; `vercel:verification` for post-release user-flow checks. No deployment is triggered by loading either skill. |

### Deferred caching option and optional planning skill

- **D1:** use `gravitas` to record the design decision, `vercel:react-best-practices` for server/client/data boundaries, and official `supabase` for private-data isolation. Read installed Next.js cache/CSP docs first. Do not install or activate a cache-conversion workflow automatically.
- **`improve-animations`:** use only before a motion batch if a more detailed audit/work order is needed. It is not the skill to execute source-code changes. Move to `animate`/`make-interfaces-feel-better` for implementation and `review-animations` afterward.
- **New Supabase skills:** their assignments above are recommendations, not a claim that they are installed. Verify availability when the relevant batch starts, read the installed instructions, and use the installation guidance later in this document if needed. Unrelated frontend phases can proceed independently.
- **Media/tooling gap:** no new media skill is required to begin. If suitable encoding/profiling tools are unavailable, record the limitation and continue unrelated work; do not substitute visual simplification for asset optimization.

## Phase 0 - Baseline and preservation inventory

Primary references: [performance results](../PERFORMANCE-RESULTS.md), [remaining measurement work](../PERFORMANCE-REMAINING.md), [measurement script](../backend/scripts/measure-performance.mjs), and [project scripts](../package.json).

- [x] **P0.1** Record commit, dirty-file state, Node/package versions, configuration mode, representative data size, browser, viewport, and test device. Keep secrets out of evidence.
- [x] **P0.2** Inventory the public homepage/course/about/contact/legal routes; student courses/explore/billing/profile; admin/support panels; checkout/confirmation/refunds; and player/progress/notes/resources.
- [x] **P0.3** Capture matching before screenshots for mobile and desktop in both themes, including loading/error/empty states. Record representative animation clips as well as static screenshots.
- [x] **P0.4** Measure a production build, not `next dev`. Separate cold and warm visits, first-time video versus returning visitor, anonymous versus authenticated sessions, and cache hits versus misses. Use isolated local/staging data.
- [x] **P0.5** Run at least three comparable mobile measurements per critical route and report median and range. Capture LCP, CLS, lab blocking time, TTFB, transferred bytes, initial JS/CSS, and request counts.
- [x] **P0.6** Capture interaction traces for carousel hover/scroll, dashboard tabs, rapid order-detail switching, current-lesson reselection, player seek/playback, and payment confirmation. Record dropped frames and long tasks.
- [x] **P0.7** Record existing lint/type/test failures separately, without relabelling them as new regressions. Set route-specific improvement budgets from this baseline.

Completion gate: reproducible before measurements and a named preservation inventory exist. The historical Lighthouse score is not the new baseline. Synthetic provider fixtures are not evidence of live payment or DRM performance.

## Phase 1 - Interaction correctness and smooth motion

Affected areas: [student dashboard](../frontend/components/student-dashboard.tsx), [order panel](../frontend/components/admin/orders-panel.tsx), [order styles](../frontend/styles/admin-shared.css), [carousel](../frontend/components/floating-card-marquee.tsx), [landing styles](../frontend/styles/landing.css), [homepage](../frontend/pages/home-page.tsx), and [player styles](../frontend/styles/video-learning.css).

- [x] **P1.1** Make current-lesson reselection idempotent. Do not clear loaded content unless a replacement request will run. Verify selecting the current lesson, reopening the same course, retrying a failed request, and changing lessons.
- [x] **P1.2** Make order-detail responses latest-selection-wins. Invalidate obsolete requests and scheduled opening callbacks on another selection, dismissal, filtering/paging, or unmount. Guard reconciliation refreshes against replacing another selected order.
- [x] **P1.3** Preserve inline detail expansion directly below its order. Establish a real closed starting state, move padding inside a clipping wrapper, and remove content only when collapse finishes. Keep the current approximately 280ms expansion and fade character; handle rapid close/reopen and reduced motion without timer-related gaps or reopening.
- [x] **P1.4** Give carousel orbital motion one timing owner. Keep the existing frame-driven path and hover speed easing; remove competing CSS interpolation from the same positioning transform, not the carousel animation. Preserve radius, speed, direction, card geometry, and visible content.
- [x] **P1.5** Make both halves of the homepage ticker identical, including percentage values and geometry, so its existing 32-second loop has no content discontinuity.
- [x] **P1.6** Keep player controls visible while they contain keyboard focus. Retain pointer fade behavior, captions, seeking, speed, volume, fullscreen, and any supported picture-in-picture behavior.
- [x] **P1.7** Replace unbounded `transition: all` declarations with the properties actually intended by each effect. Preserve existing visible transitions; do not introduce a new timing system or remove hover feedback.
- [x] **P1.8** Profile blur/shadow/mask repaint regions before changing them. If they are a demonstrated bottleneck, isolate static visual layers from moving layers while preserving their appearance. Keep existing offscreen/hidden-tab pausing and cleanup.
- [x] **P1.9** Keep meaningful loading feedback during order-filter changes. Suspend legacy checkout-status polling while hidden and resume on return without consuming its retry budget or losing payment-state checks.
- [x] **P1.10** Verify slow-motion playback, interruption, keyboard/touch use, both themes, and existing reduced-motion behavior. Add focused regression coverage for stale responses and stuck loading; use browser traces for animation feel.

Completion gate: no stuck player loading on reselection; rapid order clicks never show an obsolete selection; close cannot be undone by an old response; expansion/collapse has no final space snap; ticker and carousel retain all motion without their identified timing conflicts.

## Phase 2 - Media, branding, thumbnails, and fonts

Affected areas: [festival video](../frontend/components/festival-video.tsx), [branding component](../frontend/components/bull-mark.tsx), [course cards](../frontend/components/course-card.tsx), [uploaded thumbnails](../backend/admin/thumbnails.ts), [homepage font definitions](../frontend/pages/home-page.tsx), and [root imports](../frontend/layouts/root-layout.tsx).

Implementation update, 9 November: P2.1-P2.6 code work and non-browser checks are complete. Browser testing was explicitly delegated to the user. Original acceptance items below remain unchecked where they include visual, network-in-browser, or interaction checks. See [Phase 2 results and manual checklist](./PERFORMANCE-PHASE-2-RESULTS-2026-11-09.md). This is not a claim of completed browser acceptance or a measured whole-site speed increase.

- [x] Inspect/re-encode the full greeting; retain original audio, duration, frame rate, resolution and source file.
- [x] Verify MP4 metadata ordering, production HTTP byte ranges, MIME types and versioned asset cache headers.
- [x] Add pixel-identical lossless logos, intrinsic dimensions, native lazy loading and intent-driven alternate-theme warming.
- [x] Add bounded responsive thumbnail widths across public, student, admin and player surfaces; preserve original/external/private URLs as appropriate.
- [x] Review all `unoptimized` uses individually; retain QR/data-image and unconfigured external portrait handling.
- [x] Remove forced annotation-font preload while retaining font files, families, glyphs and fallback metrics.
- [x] Pass production build, lint, types, 152 component tests, 62 backend/asset tests and focused HTTP security/cache checks.
- [ ] User completes the visual, playback, theme-switch, thumbnail, font and cold/warm network checklist.

- [ ] **P2.1** Inspect the 15.2 MB greeting video's duration, bitrate, resolution, codec, audio, and MP4 metadata location. Produce candidate efficient encodes and, if justified, mobile/desktop variants. Preserve complete content and visible quality; keep originals until visual acceptance.
- [ ] **P2.2** Verify streaming-friendly video delivery, byte ranges, MIME type, versioned URLs, and cache headers. Preserve once-per-browser autoplay, immediate skip, replay, muted playback, focus restoration, and error fallback. Do not delay autoplay merely to improve a benchmark.
- [ ] **P2.3** Optimize logo dimensions/encoding and load the active theme asset first rather than eagerly requesting both themes. Load the alternate when needed without a theme-switch flash; reserve image dimensions.
- [ ] **P2.4** Generate appropriate thumbnail variants for cards, compact player/sidebar uses, and course details. Preserve aspect ratios and sharpness; update responsive sizes and lazy loading. Keep immutable identifiers and existing publication/privacy rules.
- [x] **P2.5** Review each `unoptimized` image separately. Keep it for generated data images or authenticated sources where appropriate; do not blanket-enable an optimizer that cannot retrieve the source safely.
- [ ] **P2.6** Avoid unnecessary handwriting-font preload at widths where annotations are hidden. Keep existing typefaces, fallback metrics, and necessary language glyphs. Confirm actual network/font usage instead of assuming every declared subset downloads.
- [ ] **P2.7** Compare first-visit versus returning-visit bytes and visible quality at identical settings. Test video startup and skip during slow loading, logo theme switches, thumbnail updates, and font layout stability.

Completion gate: smaller measured delivery for the affected assets, unchanged complete video/branding/artwork experience, no new layout shift, and no reliance on stale cached assets after an update. Set numerical reduction goals after inspecting candidate encodes; do not promise an unsupported percentage.

## Phase 3 - Authentication, request deduplication, and view loading

Affected areas: [auth provider](../frontend/components/auth-provider.tsx), [admin workspace](../frontend/components/admin/admin-workspace.tsx), [server session checks](../backend/auth/session.ts), [request proxy](../proxy.ts), [dashboard route](../app/dashboard/page.tsx), [student dashboard](../frontend/components/student-dashboard.tsx), and [billing hook](../frontend/lib/use-billing-orders.ts).

Implementation update, 9 November: P3.1-P3.8 engineering work/decisions and local non-browser checks are complete. P3.9 browser/provider acceptance and signed-in timing measurements remain with the user. See [Phase 3 results, request chains and manual checklist](./PERFORMANCE-PHASE-3-RESULTS-2026-11-09.md). Items below remain unchecked where they include unperformed browser acceptance; no live/whole-site latency improvement is claimed.

- [x] Share the admin/header identity request and preserve structured authentication errors, roles and MFA gating.
- [x] Add navigation/focus verification and cross-tab invalidation without persisting identities or tokens; hide obsolete account data and ignore stale replies.
- [x] Keep server identity memoization render-scoped; retain admission, revocation, role and activity checks at server boundaries.
- [x] Limit proxy bypass to existing public UUID thumbnail GET/HEAD routes and the two exact public favicons; keep other APIs/private routes protected.
- [x] Replace unrelated full billing payloads with owner-scoped count-only reads, preserve billing deep links and fetch details on demand.
- [x] Reuse fresh server billing/announcement snapshots with explicit refresh rules and test abort/focus/history behavior.
- [x] Reduce supported-provider full-history polling while retaining status checks, UPI freshness, authoritative settlement reads and bounded/hidden-tab guards.
- [x] Evaluate the combined admission/activity RPC; retain the existing activity update rather than require a database migration in this batch.
- [x] Pass build, lint, types, 193 component/API tests and 62 backend/asset tests.
- [ ] Complete the user's browser/real-provider acceptance and comparable signed-in navigation measurements.

- [x] **P3.1** Draw the actual anonymous/signed-in request chain and count duplicate identity requests before changing it. Separate proxy refresh, endpoint authorization, and client display state.
- [ ] **P3.2** Reuse shared client identity/in-flight requests and verified server identity where available, rather than independently fetching the same identity in the admin shell. Preserve role, AAL/MFA, session revocation, blocked-account, and device-limit handling.
- [x] **P3.3** Define freshness, focus-refresh, account-switch, login, and logout invalidation rules. Avoid sharing private identity across requests or users. Keep authorization at every protected server boundary.
- [ ] **P3.4** Narrow unnecessary proxy work for explicitly public static assets. Verify all protected routes and public-thumbnail behavior; do not broadly exempt APIs or private files without checking their independent authorization.
- [ ] **P3.5** Render the selected dashboard view from its required data first. Use lightweight summaries for counts; defer unrelated billing history or details. Keep deep links, history/back navigation, error/retry states, and every tab functional.
- [x] **P3.6** Use server-provided announcements as the initial snapshot and apply an explicit freshness policy. Remove the unconditional immediate duplicate fetch while retaining updates.
- [ ] **P3.7** Preserve existing billing poll overlap guards, bounded checks, hidden-tab pauses, and pending-order reconciliation. Avoid redundant full-history rereads; keep fresh payment state after returning from the payment app.
- [x] **P3.8** Consider combining the conditional five-minute activity touch with admission verification so a no-op activity update does not always require another network round trip. Preserve activity and revocation semantics. Decision: keep it unchanged in this batch; a combined RPC needs versioned database rollout and transactional revocation/activity verification, not omission of the check.
- [ ] **P3.9** Test anonymous, student, support, admin, expired/revoked/blocked sessions, MFA/device-limit errors, focus refresh, logout, and account switching. Compare request counts and signed-in navigation timings.

Completion gate: repeated identity/data requests decrease without weakening permissions, introducing cross-account state, or leaving navigation and billing stale.

## Phase 4 - Database reads, reporting, and payment-side latency

Affected areas: [purchase repository](../backend/purchase/repository.ts), [billing reads](../backend/purchase/billing.ts), [admin handler](../backend/handlers/admin.ts), [course lookup SQL](../backend/database/migrations/202610310011_course_access_expiry.sql), [learner reporting SQL](../backend/database/migrations/202611010012_admin_course_learners.sql), [lesson access](../backend/learning/data.ts), [receipt delivery](../backend/purchase/mail.ts), [success page](../app/checkout/success/page.tsx), and [gateway client](../backend/payments/indianxtrade.ts).

- [ ] **P4.1** Capture representative query plans, request counts, payload sizes, and latency distributions in an isolated or explicitly scoped environment. Inspect deployed indexes; do not assume missing indexes from source alone. Avoid executing mutating `EXPLAIN ANALYZE` statements against production.
- [ ] **P4.2** Query the selected course before constructing curriculum/progress JSON, rather than assembling the entire personalized catalogue. Preserve published-state, preview, access-expiry, and progress rules; follow the current UPI SQL wrappers.
- [ ] **P4.3** Parallelize independent legacy/current order reads or unify them. Introduce stable pagination across the combined history; preserve every historical order, total/count semantics, sorting, receipts, and pending-payment discovery.
- [ ] **P4.4** Batch refund evidence for the authorized page into one operation rather than one remote RPC per item. Compare results against the existing eligibility implementation. Recheck current evidence transactionally before consequential refund actions.
- [ ] **P4.5** Scope lesson access data and join lesson/module/course metadata where appropriate, instead of repeated account-wide reads and sequential lookups. Preserve protected video/resource and expiry rules.
- [ ] **P4.6** Paginate course-learner summaries and load individual lesson-level details on selection. Preserve totals, filters, progress calculations, and support access to every learner.
- [ ] **P4.7** Return confirmed payment state without waiting for receipt transport. Use the existing durable outbox with a prompt, retryable worker trigger; the existing daily schedule alone is not a substitute for prompt delivery. Preserve claim handling, idempotency, deduplication, and delivery visibility. Do not use untracked fire-and-forget promises.
- [ ] **P4.8** Reuse shared-gateway collector sessions with account-keyed isolation, expiry handling, and coordinated refresh. Preserve 401 recovery and payment verification; never expose collector sessions or credentials to browsers or cache user authorization globally.
- [ ] **P4.9** Add or adjust indexes only when query plans demonstrate the need. Check hosting/database region alignment before proposing infrastructure changes. Preserve local-demo compatibility where these flows support it.
- [ ] **P4.10** Prepare additive/versioned migrations and API/UI changes together. Test on isolated data, preserve financial snapshots, verify rollback strategy, and document shared-environment execution separately.
- [ ] **P4.11** Run targeted database/payment/auth regression checks, including wrong-owner access, expired access, pagination boundaries, duplicate settlement events, receipt retries, gateway failures, and unchanged refund calculations.

Completion gate: fewer proven round trips/smaller scoped payloads, unchanged authorized results and financial behavior, and payment confirmation no longer coupled to email transport latency. Source-based findings are not considered deployed until the target environment is separately verified.

## Phase 5 - JavaScript, CSS, and rendering efficiency

Affected areas: [shared layout](../frontend/layouts/root-layout.tsx), [dashboard imports](../app/dashboard/page.tsx), [student panels](../frontend/components/student-dashboard.tsx), [player](../frontend/components/purchase-player.tsx), [global styles](../frontend/styles/globals.css), [branding styles](../frontend/styles/brand.css), and [admin shared styles](../frontend/styles/admin-shared.css).

- [ ] **P5.1** Inspect the fresh production route manifests/network waterfall. Separate initial chunks from deferred chunks and raw sizes from transferred compressed bytes.
- [ ] **P5.2** Split secondary student panels where the measured initial bundle warrants it. Preload on navigation intent/appropriate idle time; retain equivalent skeletons and verify the first visit to each tab.
- [ ] **P5.3** Keep base tokens, reset, and genuine shared styles global. Scope player, checkout, auth, admin, and student styles appropriately without changing cascade precedence or visual output.
- [ ] **P5.4** Consolidate duplicated logo/theme selectors after checking their effective specificity and responsive overrides. Do not run blanket CSS purging against dynamically generated class names.
- [ ] **P5.5** Profile player `timeupdate` renders. Isolate frequently updating controls from stable curriculum/notes/content only when measurements justify it; preserve seeking, timers, notes, completion, and lesson changes. Bound DRM attach polling and surface a recoverable failure if attachment never succeeds.
- [ ] **P5.6** Reduce repeated data serialization between server/client boundaries and duplicated course arrays where contracts permit. Keep initial rendering and interactive behavior intact.
- [ ] **P5.7** Compare initial and navigated CSS/JS delivery, panel-switch latency, hydration errors, keyboard focus, layout, theme switching, and motion at every affected breakpoint.

Completion gate: initial work decreases on measured routes without merely moving delay to the first interaction. Both first-load and client-navigation styling remain correct.

## Phase 6 - Proven unused code and duplicate assets

Do this after active flows are established. These tasks mainly reduce maintenance risk; orphan modules are not presumed to contribute browser bytes.

- [ ] **P6.1** Re-run import, re-export, framework-entrypoint, test, script, configuration, and asset-reference checks before deleting anything. Account for dynamic imports and public URLs.
- [ ] **P6.2** Remove [the unused demo payment component](../frontend/components/demo-payment-panel.tsx) only after reconfirming it is not an intended supported entrypoint. Keep reachable demo backend functionality.
- [ ] **P6.3** Resolve [the unreferenced student refund component](../frontend/components/student-refund-control.tsx) against the preservation inventory: remove a proven obsolete duplicate, or record a missing intended connection as a separate functional issue. Do not remove the refund capability.
- [ ] **P6.4** Remove confirmed-unused `paymentProvider`/`idempotencyKey` exports from [legacy demo helpers](../backend/payments/demo.ts) and `StudentsSkeleton`, `OrdersSkeleton`, `AnnouncementsSkeleton`, and `TeamSkeleton` from [admin skeletons](../frontend/components/admin/admin-skeletons.tsx), keeping the other active exports.
- [ ] **P6.5** Review test-only [old checkout UI](../frontend/components/checkout-form.tsx), [Cashfree UI](../frontend/components/cashfree-payment-panel.tsx), [old catalogue UI](../frontend/pages/catalogue-page.tsx), and [calculation helper](../backend/payments/calculations.ts). Map useful assertions to current production flows before retiring stale tests/code. Do not delete the 410 compatibility response merely because its old client is unused.
- [ ] **P6.6** Consolidate byte-identical [dark wordmark](../public/brand/indianxtrade-wordmark-dark.png)/[dark logo](../public/brand/indianxtrade-dark.png) and [light wordmark](../public/brand/indianxtrade-wordmark-light.png)/[light logo](../public/brand/indianxtrade-light.png) references. Preserve externally consumed URLs with aliases/compatibility where needed; do not delete assets based on repository references alone.
- [ ] **P6.7** Remove exclusively obsolete CSS after confirming dynamic/shared selectors. Keep migrations, framework entrypoints, tests, relay code, and compatibility branches unless independently proven obsolete. Remove dependencies only with production/test/build/config usage evidence; none was conclusively unused in the audit.

Completion gate: no broken routes, assets, imports, tests, supported provider modes, or features. Report maintenance savings separately from measured transfer/bundle savings.

## Phase 7 - Final verification and handoff

- [ ] **P7.1** Run focused lint, formatting, type, and existing relevant tests after each implementation batch. Add tests for meaningful regressions/authorization/payment behavior, not tests that merely mirror reversible styling edits.
- [ ] **P7.2** Run the final production build and appropriate existing suites: unit/backend, release browser, and purchase flows. Review their environment setup first; do not let a script unexpectedly seed, migrate, email, or mutate shared/live services.
- [ ] **P7.3** Repeat the same performance scenarios, devices, throttling, data, and cache conditions used in Phase 0. Publish before/after median/range, bytes, request counts, long tasks, and API timings. Treat the video-first-visit scenario separately.
- [ ] **P7.4** Verify homepage, catalogue/detail, legal/contact, login/logout/recovery/devices, student/admin/support navigation, all panels, billing/receipts, checkout/confirmation/refunds, protected player/progress/resources/notes, and history/back navigation against the preservation inventory.
- [ ] **P7.5** Compare both themes and mobile/tablet/desktop screenshots. Review clips at normal and slowed speed for every preserved animation. Check rapid interruption, touch, keyboard, hidden-tab/resume, and reduced-motion modes.
- [ ] **P7.6** Check cold/warm public cache behavior, publication invalidation, updated thumbnails, separate user sessions, logout invalidation, expired access, and absence of private-data caching/leakage.
- [ ] **P7.7** Verify real provider/DRM behavior in the appropriate supported environment where available; explicitly record any remaining unverified physical-device or external-service checks rather than treating fixtures as proof.
- [ ] **P7.8** Prepare a change summary, migration/worker/deployment notes if needed, a rollback plan, and an evidence-backed list of improvements and remaining limitations. Do not deploy automatically from this planning request.
- [ ] **P7.9** After an authorized release, collect real-user LCP/INP/CLS segmented by mobile/desktop with privacy-conscious monitoring. Use 75th-percentile targets of LCP <= 2.5s, INP <= 200ms, and CLS <= 0.1; these are goals, not a promise or claims based on lab-only results.

Completion gate: all preservation checks pass, targeted performance measurements improve without material regressions elsewhere, and any pending external verification is clearly named. Do not claim completion from a Lighthouse score alone.

## Verification commands for the implementation stage

These are future commands, not commands executed while writing this plan. Confirm current script behavior and isolated environment first.

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:unit
npm run build
npm run test:release
npm run test:purchase
```

Use focused equivalents during a batch, then the relevant full checks for final verification. The existing `test:performance` script uses a synthetic loopback environment and writes reports; review/extend it to cover the required real scenarios instead of treating it as hosted latency evidence. No dependency installation is inherently required to begin.

## Skill recommendations

### Already installed: use these selectively

| Skill                         | Role in this plan                                                                  | Important boundary                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `gravitas`                    | Scoped implementation, requirement tracking, evidence and completion gates         | Do not claim a speed gain without comparable measurements.                                                                                     |
| `karpathy-guidelines`         | Small, necessary changes and careful legacy cleanup                                | No broad redesign or speculative abstraction.                                                                                                  |
| `vercel:react-best-practices` | Request waterfalls, component boundaries, code splitting, serialization, rerenders | Already installed and contains the comprehensive React performance categories; no duplicate install needed. Profile before adding memoization. |
| `make-interfaces-feel-better` | Preserve visual polish during animation/style changes                              | No feature or visual simplification under the label of optimization.                                                                           |
| `animate`                     | Implement the narrow expansion/timing changes when useful                          | Preserve existing effects; prefer current CSS/browser tools and no new motion dependency.                                                      |
| `review-animations`           | Review implemented motion and interruption behavior                                | Override deletion advice; natural row expansion may require layout. Pair source review with real browser traces.                               |
| `vercel:verification`         | Browser -> API -> data -> rendered-result verification                             | Use appropriate test environments; fixture success is not live-provider acceptance.                                                            |
| `improve-animations`          | Planning/audit only, if more detailed motion work orders are needed                | Not the source-code implementation skill.                                                                                                      |

The installed Next.js docs and [project agent instructions](../AGENTS.md) remain authoritative for the installed framework version. Do not follow an external skill's older API conventions over those docs.

### Recommended downloads: official Supabase skills

Implementation-time update, 9 November: both skills below are now available in this session. No download is needed to continue. The original recommendation/installation commands are retained as planning history; this implementation batch did not install them.

1. **`supabase-postgres-best-practices` - highest-value addition.** Use for query plans, batched refunds, scoped SQL, indexes, pagination, migrations, concurrency, and database permission preservation. The directory listed approximately 478.1K installs and the official repository approximately 3K stars when checked; popularity is supporting context, not a guarantee.
2. **`supabase` - useful companion for authentication/backend work.** Use for the SSR/auth/session integration, client configuration, and Supabase product-specific behavior.

Install only if desired; neither command has been run:

```powershell
npx skills add supabase/agent-skills --skill supabase-postgres-best-practices
npx skills add supabase/agent-skills --skill supabase
```

References: [official Supabase installation and scope](https://supabase.com/docs/guides/ai-tools/ai-skills), [official repository](https://github.com/supabase/agent-skills), and [database skill listing](https://skills.sh/supabase/agent-skills/supabase-postgres-best-practices). The CLI defaults to project scope; use `--global` only if the user wants these across projects.

Do not download another React skill just to duplicate the installed one. The [official React skill](https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices) covers the same performance categories already available locally.

Do not install the retired `next-best-practices` skill for this project. The [maintainer migration notice](https://github.com/vercel-labs/next-skills) says its reference knowledge now ships through bundled Next.js docs. Current cache-component workflow skills are optional later, not a reason to convert this project's caching architecture now.

No additional design-generation skill or UI-library installation is needed. This is an optimization project, not a redesign.

## Deferred architectural option - not a prerequisite

- [ ] **D1** Only if measurements show that remaining public-page server work is important, design a cacheable public-shell approach that preserves nonce/CSP security, identity-dependent navigation, and admin redirects. Record tradeoffs before implementation. Do not enable cache components, remove `force-dynamic`, or weaken CSP mechanically.

Current public-data caching should be preserved and measured first. References: [Next.js CSP rendering constraints](https://nextjs.org/docs/app/guides/content-security-policy), [browser animation performance](https://web.dev/articles/animations-guide), and [Core Web Vitals targets](https://web.dev/articles/vitals).

## Batch evidence record

Copy this section for each implementation batch:

- Batch/task IDs:
- Status: NOT STARTED / IN PROGRESS / VERIFIED / NEEDS FOLLOW-UP
- Files changed:
- Features/animations checked:
- Before measurements and conditions:
- After measurements and conditions:
- Checks run and actual results:
- Remaining limitations:
- Rollback method:

### Batch 1 - 9 November 2026

- Task IDs: P0.1; P1.1-P1.7 and P1.9 implementation; partial P0/P1 verification.
- Status: core interaction fixes verified locally; Phase 0 and Phase 1 overall still IN PROGRESS.
- Evidence, exact checks, baseline limitations, pending motion profiling, and rollback boundaries: [batch results](./PERFORMANCE-PHASE-0-1-RESULTS-2026-11-09.md).
- Phases 2-7 and D1 remain unimplemented. No production deployment or shared-database change.

### Batch 2 - Phase 0-1 closeout, 9 November 2026

- Task IDs: P0.1-P0.7, P1.1-P1.10.
- Status: VERIFIED for the isolated local scope. Supersedes Batch 1's in-progress status.
- Evidence and measured budgets: [closeout](./PERFORMANCE-PHASE-0-1-CLOSEOUT-2026-11-09.md).
- Preserved blur, shadows, masks, motion, functions and security boundaries. Layout-shift outliers and cold admin latency are measured future optimization work, not hidden or claimed fixed.
- Phase 2 remains NOT STARTED, as requested for this handoff.

### Batch 3 - Phase 2 implementation, 9 November 2026

- Task IDs: P2.1-P2.6 implementation and non-browser verification; P2.7 browser acceptance delegated to the user by request.
- Status: CODE COMPLETE; BROWSER/VISUAL ACCEPTANCE PENDING. Supersedes Batch 2's Phase 2 not-started status only.
- Evidence and user testing steps: [Phase 2 results](./PERFORMANCE-PHASE-2-RESULTS-2026-11-09.md).
- Video bytes reduced 38.7%; lossless branding reduced 28.9-46.5%. No unsupported whole-site latency improvement is claimed.
- No browser tools/tests, production deployment, shared-database change, dependency change, commit or Phase 3 implementation.

### Batch 4 - Phase 3 implementation, 9 November 2026

- Task IDs: P3.1-P3.8 implementation/decisions and non-browser verification. P3.9 browser acceptance/timing comparisons remain open at the user's request.
- Status: CODE COMPLETE; BROWSER/PROVIDER ACCEPTANCE PENDING. Supersedes Batch 3's Phase 3 not-started status only.
- Evidence: [Phase 3 results](./PERFORMANCE-PHASE-3-RESULTS-2026-11-09.md).
- Deterministic billing fixture: 80 requests before, 47 after; all 40 status checks retained. Non-billing dashboards use count-only reads instead of full history. These are local/source-backed reductions, not production navigation measurements.
- No browser tests, new dependencies, SQL migrations, shared-data mutation, deployment, commit/push or Phase 4 implementation.
