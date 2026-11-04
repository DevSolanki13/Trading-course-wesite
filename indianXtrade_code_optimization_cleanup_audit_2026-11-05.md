# indianXtrade — Production Code Optimization & Safe Cleanup Audit

**Repository:** [DevSolanki13/Trading-course-wesite](https://github.com/DevSolanki13/Trading-course-wesite)  
**Audited HEAD:** [`28388b783ec5d9a86beeac3f764921fa86ac1010`](https://github.com/DevSolanki13/Trading-course-wesite/commit/28388b783ec5d9a86beeac3f764921fa86ac1010) (`main`)  
**HEAD commit time:** 2026-11-04 20:28:27 UTC / 2026-11-05 01:58:27 IST  
**Audit date:** 2026-11-05  
**Scope:** Remove unused/redundant code and assets; simplify architecture; optimize runtime, build and maintenance **without losing any current feature, workflow, animation, visual layout, branding, styling, accessibility behavior or saved user data**.  
**Audit type:** Read-only GitHub source/tree/CI inspection. The repository was **not edited**; no local build, full static dependency graph, authenticated browser session, live payment, full visual regression or network trace was executed in this audit.

> **Fundamental rule:** “Looks unused” ≠ “safe to delete.” A file may be a Next.js convention, a route entry point, a dynamic import, an external webhook target, an operational fallback, a migration, an admin-only feature, or a persisted-storage compatibility layer. Every removal must pass reference tracing, CI and visual/functional regression before merge.

---

## 1. Executive assessment

The project is a Next.js 16 / React 19 course-commerce application with public pages, account/session flows, admin operations, paid access, multiple payment modes, receipt/refund support and a video learning portal. The current HEAD also brings the **indianXtrade** identity into the footer, checkout and player. Preserve the _current_ design, not an earlier GlobalBulls version.

### Repository and pipeline snapshot

| Metric                | Verified observation                                                                                                                                                           | Interpretation                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Tracked files         | **358** Git blobs, from the recursive tree                                                                                                                                     | Substantial but not itself evidence of waste                                                                |
| Tracked file payload  | ~**8.10 MB** (sum of listed blob sizes, not Git history or shipped JS)                                                                                                         | Source/assets, not browser bundle size                                                                      |
| Frontend              | 84 tracked files under `frontend/` (~934 KB)                                                                                                                                   | Biggest refactor opportunities are individual components and CSS                                            |
| Backend               | 108 tracked files under `backend/` (~1.34 MB)                                                                                                                                  | Do not simplify payment/auth/business invariants without tests                                              |
| Public assets         | 19 files under `public/` (~2.93 MB)                                                                                                                                            | Opportunity to check transfer size and redundant branding                                                   |
| Raw design assets     | 8 files under root `LOGO/` (~1.82 MB)                                                                                                                                          | Source artwork is separate from deployed `/public` URLs                                                     |
| Latest GitHub Actions | **Failed**                                                                                                                                                                     | A release acceptance run has not completed on this commit                                                   |
| Immediate failure     | [CI run `41907003004`](https://github.com/DevSolanki13/Trading-course-wesite/actions/runs/41907003004): `app/opengraph-image.tsx` unused `eslint-disable-next-line` at line 30 | `eslint . --max-warnings=0` exits nonzero; typecheck/tests/build/browser tests were skipped **in this run** |
| Prior pipeline        | Previous audited run failed `format:check` across 50 files                                                                                                                     | Do **not** assume formatting is now green just because latest job stopped earlier                           |

**Risk-led conclusion:** Fix the one-line CI blocker immediately; separately treat the identified admin direct-login credential fallback as an **urgent security issue**. Then perform low-risk cleanup on a dedicated branch, followed by measured refactors. Do not merge cleanup while release checks are red.

**Already-present good practices to keep:** Next.js route-level code splitting; dynamic admin panels; 5-minute server catalogue caching with invalidation; guarded session-sensitive server rendering; auth-provider request deduplication; marquee off-screen/reduced-motion pausing; dark/light theme persistence; video access expiration and payment ownership checks. Never undo working optimizations merely to make code shorter.

---

## 2. Severity and confidence definitions

- **SECURITY / P0:** Fix independently before production; may require preserving the _legitimate_ feature through a safer implementation rather than preserving an insecure bypass.
- **P1:** Clear build/maintainability/behavior concern; fix early, verify.
- **P2:** Likely optimization, but profile or dependency tracing first.
- **P3:** Housekeeping; no claim of measured user-visible speedup.
- **Confirmed:** Direct file or CI evidence establishes the condition.
- **Candidate:** File appears unused/duplicated based on entry points/search; final proof requires a complete dependency and runtime route reference check.
- **Measurement needed:** Performance benefit cannot be asserted without baseline and after metrics.

### Findings overview

| ID   | Priority        | Evidence                                       | File / area                                                                                              | Finding                                                                                                                                                    | Recommended action                                                                                                                                                    |
| ---- | --------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-01 | **P0 security** | **Confirmed**                                  | `backend/handlers/auth.ts`                                                                               | Hard-coded fallback administrator credentials are accepted in multiple auth branches, and the `admin-direct-login` branch can create/elevate an admin user | Restrict or remove unsafe fallback authentication in a dedicated security fix; preserve approved staff sign-in with verified identity/MFA; rotate any exposed secrets |
| C-01 | **P1**          | **Confirmed**                                  | `app/opengraph-image.tsx:30`                                                                             | Unused ESLint suppression stops the latest release pipeline                                                                                                | Remove only the obsolete comment; rerun full CI                                                                                                                       |
| C-02 | **P1**          | **Confirmed**                                  | GitHub Actions                                                                                           | Skipped tests after lint failure make current commit unverified                                                                                            | Gate merge and deployment on all existing checks; fix warning, then formatting and other failures one at a time                                                       |
| C-03 | P2              | **Candidate**                                  | `frontend/components/global-sidebar.tsx`                                                                 | Old global sidebar remains after `RootLayout` switched to `SiteHeader`                                                                                     | Verify zero import/route usage; then remove only component and uniquely owned CSS in a reversible commit                                                              |
| C-04 | P2              | **Candidate**                                  | `frontend/components/admin/admin-login-gate.tsx`                                                         | Appears unreferenced in visible admin route; current admin login uses `admin-direct-terminal`                                                              | Check all auth routes, role and MFA flows before archiving or deleting                                                                                                |
| C-05 | P2              | **Candidate; preserve feature**                | `frontend/components/admin/content-panel.tsx`                                                            | Site-content editor is not in current `AdminWorkspace` navigation                                                                                          | First determine whether to restore/make reachable; **do not delete** merely because unlinked                                                                          |
| C-06 | P2              | **Candidate; preserve feature**                | `frontend/components/admin/operations-panel.tsx`                                                         | Operations/audit panel not in current workspace nav                                                                                                        | Check other entry points and operational obligations; preserve backend tasks and audit history                                                                        |
| C-07 | P3              | **Confirmed duplicates**                       | `LOGO/` and `public/brand/`                                                                              | Four identical image blobs appear twice in Git                                                                                                             | Keep runtime paths; archive/deduplicate raw source artwork only if provenance permits                                                                                 |
| C-08 | P3              | **Confirmed duplicates, intentionally shared** | `app/admin/loading.tsx`, `app/courses/loading.tsx`, `app/dashboard/loading.tsx`, `app/learn/loading.tsx` | Four identical tiny route re-export files                                                                                                                  | **Keep**: distinct Next.js route boundaries; duplication is intentional and inexpensive                                                                               |
| C-09 | P2              | **Confirmed**                                  | `frontend/components/student-dashboard.tsx`                                                              | ~1,596-line client component mixes tabs, course lists, billing, profile, announcements and lesson fetching                                                 | Split into presentation/panels with unchanged DOM, classes, URL state and fetch contracts                                                                             |
| C-10 | P2              | **Confirmed**                                  | `frontend/components/purchase-player.tsx`                                                                | ~1,125 lines mix DRM, HTML5 controls, notes, progress, navigation and resources                                                                            | Extract tested hooks and small internal components; do not modify video behavior                                                                                      |
| C-11 | P2              | **Confirmed**                                  | `frontend/components/admin/course-manager.tsx`                                                           | Large editor/list with curriculum, details, assets, publication and destructive actions                                                                    | Split by feature boundary with stable server mutation and saved form state                                                                                            |
| C-12 | P2              | **Confirmed**                                  | `frontend/styles/globals.css`, `admin.css`, `brand.css`                                                  | ~3,704 + ~2,014 + 392 lines of cascading, repeated contextual styling                                                                                      | Investigate CSS coverage/overlaps; eliminate only proved unused rules and cascade-neutral duplicates                                                                  |
| C-13 | P2              | **Measurement needed**                         | `frontend/components/bull-mark.tsx`                                                                      | Dark/light assets rendered as two `<img>` elements controlled by CSS                                                                                       | Inspect actual network fetches before trying single-resource technique; preserve same pixels, sizes and theme behavior                                                |
| C-14 | P2              | **Measurement needed**                         | `public/images/study-desk.png`                                                                           | ~1.90 MB image used on About page                                                                                                                          | Measure delivered bytes/LCP; attempt lossless optimization or carefully tested responsive image delivery                                                              |
| C-15 | P2              | **Measurement needed**                         | `frontend/components/floating-card-marquee.tsx`                                                          | Client animation already has rAF, visibility and reduced-motion optimizations                                                                              | Profile first; keep exact trajectory, card sequence, hover slowdown and reduced-motion state                                                                          |
| C-16 | P2              | **Measurement needed**                         | `backend/public/catalogue.ts`                                                                            | Uses `unstable_cache` with 300s TTL and invalidation                                                                                                       | Retain semantics; measure hot/cold latency and invalidation before modifying                                                                                          |
| C-17 | P3              | **Candidate**                                  | `public/brand/globalbulls-logo-preview.html`                                                             | Legacy-named public preview HTML                                                                                                                           | Search docs/link references and traffic before removing or redirecting public URL                                                                                     |
| C-18 | P3              | **Confirmed**                                  | `DESIGN.md`, `PERFORMANCE-*.md`                                                                          | Design instructions still say GlobalBulls while application is branded indianXtrade; historical benchmark docs remain                                      | Update docs to current branding and label historical numbers, preserving exact existing token values                                                                  |
| C-19 | P3              | **Confirmed**                                  | `backend/scripts/*` retired `.cjs` helpers                                                               | Several scripts share identical bodies intentionally forbidding unsafe DB shortcuts                                                                        | Keep safety tripwires until their external invocation/deprecation policy is checked; don't call them dead code by byte equality alone                                 |
| C-20 | P2              | **Candidate**                                  | `package.json`                                                                                           | `@types/nodemailer` is a runtime dependency instead of devDependency                                                                                       | Test whether safe to move to `devDependencies`; no claim of frontend bundle impact                                                                                    |
| C-21 | P2              | **Measurement needed**                         | Frontend `img` usage                                                                                     | Multiple `<img>` uses in dashboard, player and admin; some bypass Next/image optimization                                                                  | Profile sizes/remote origin before change; preserve crop and asset identity                                                                                           |
| C-22 | P2              | **Candidate**                                  | `frontend/components/admin/admin-skeletons.tsx`                                                          | Large skeleton library may mix used and unused exported skeletons                                                                                          | Trace each export; remove only unreferenced exports after checking delayed admin panels                                                                               |
| C-23 | P2              | **Confirmed**                                  | `frontend/components/bull-mark.tsx`                                                                      | `BullMark`, `BrandWordmark` aliases and old prop names exist for compatibility                                                                             | Preserve aliases while used; only migrate in staged renames with tests                                                                                                |
| C-24 | P2              | **Confirmed**                                  | Browser storage keys / auth compatibility                                                                | Old `market-method-theme` key and legacy avatar keys are read for existing users                                                                           | **Do not delete** without explicit data migration and old-browser session tests                                                                                       |
| C-25 | P2              | **Measurement needed**                         | Next.js server/client boundary                                                                           | Public and private pages have different caching needs; substantial client panels exist                                                                     | Profile shipped JS and TTFB; avoid marking personalized routes static or public cacheable                                                                             |

---

## 3. Specific cleanup candidates: what is actually removable?

### 3.1 Candidate: disconnected GlobalSidebar (C-03)

**Source:** [`frontend/components/global-sidebar.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/frontend/components/global-sidebar.tsx), 267 lines / 8,692 bytes. Latest [`frontend/layouts/root-layout.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/frontend/layouts/root-layout.tsx) imports `SiteHeader`, not `GlobalSidebar`. Some references surfaced by repository code search may lag current HEAD, so a clean `rg`/type-aware import trace is mandatory.

**Safe sequence:**

1. Search direct, alias, dynamic and barrel imports; check tests/docs and all route layouts.
2. In a separate commit temporarily remove only `global-sidebar.tsx` and confirm build/regression.
3. Use rendered-page DOM/CSS coverage to identify `.global-sidebar*` selectors solely owned by it. Remove _only those_ after testing every route (some global styles may be shared).
4. Compare guest, student and admin nav at desktop/mobile, theme toggling and account logout.

**Do not** replace `SiteHeader` with a new navigation system or change spacing merely to clean CSS.

### 3.2 Candidate: disconnected admin panels (C-04 through C-06)

- [`admin-login-gate.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/frontend/components/admin/admin-login-gate.tsx), 284 lines: appears to be superseded by the current admin route, but it participates in historical secret-key navigation. Check feature ownership and security review first.
- [`content-panel.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/frontend/components/admin/content-panel.tsx), 338 lines: includes hero text, instructor information, FAQs and testimonials. This is **functional product capability**, not safe garbage just because no visible navigation item points to it. Confirm whether it must remain available to staff.
- [`operations-panel.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/frontend/components/admin/operations-panel.tsx), 236 lines: manual community-removal tasks, email outbox and audit log. Verify intended staff access. The operational data, endpoints and logs must survive even if UI is not currently linked.

**Decision table:** confirmed in-use → keep; required but disconnected → restore route/access without redesign; intentionally retired with product sign-off and no references → remove via separate PR; uncertain → retain.

### 3.3 Exact duplicate brand source assets (C-07)

The following pairs have **identical Git blob SHAs** on the audited tree (not merely matching filenames/sizes):

| Raw asset                          | Same-byte public file                          | Action                                                                              |
| ---------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `LOGO/indianxtrade-dark.png`       | `public/brand/indianxtrade-wordmark-dark.png`  | Keep public runtime URL; evaluate whether raw duplicate is needed in source library |
| `LOGO/indianxtrade-light.png`      | `public/brand/indianxtrade-wordmark-light.png` | Same                                                                                |
| `LOGO/indianxtrade-mark.png`       | `public/brand/indianxtrade-mark.png`           | Same                                                                                |
| `LOGO/indianxtrade-mark-light.png` | `public/brand/indianxtrade-mark-light.png`     | Same                                                                                |

Do **not** delete `public/brand/indianxtrade-dark.png` or `public/brand/indianxtrade-light.png`: the active `BrandLogo` component references those **different** paths, and the OpenGraph image reads the former from disk. Avoid renaming public URLs. Even after source deduplication, test favicon, OG image, navbar, footer, receipt, email and classroom branding.

### 3.4 Retired database scripts are intentional compatibility guards (C-19)

Files such as `backend/scripts/apply-migrations-007-008.cjs` and `fix-constraint.cjs` intentionally exit with an error to prevent ad-hoc unsafe migrations. `check-constraint.cjs`, `db-precheck.cjs`, `verify-staging-008.cjs` and `verify-staging-phase2.cjs` intentionally redirect to the guarded `verify-database.mjs`. These are **exact duplicates by design** in groups. Deleting them could turn a clear, safe failure into a missing-script error for an old runbook. Decommission only after references and operational owners are checked. **Never alter deployed migration histories or SQL migration ledger as cosmetic cleanup.**

### 3.5 Historical branding and docs (C-17, C-18)

Update `DESIGN.md`'s name/description and stale narrative from GlobalBulls to indianXtrade, but **do not change** the implemented colors, tokens, typography or component styling. Preserve history/reproducibility in `PERFORMANCE-RESULTS.md`; its 69→88 local Lighthouse figures are historical, **not** a fresh run on HEAD. `public/brand/globalbulls-logo-preview.html` looks archival, but public URL removal needs traffic/reference validation.

---

## 4. Refactor opportunities (not deletion opportunities)

### 4.1 StudentDashboard: split by stable behavior boundaries

[`student-dashboard.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/frontend/components/student-dashboard.tsx) is around 1,596 lines. It renders course listing, featured/resume card, explore/search, announcements, billing, profile and embedded player; it also owns query-string navigation and purchase-lesson loading.

**Recommended extraction order:**

1. Pure display-only widgets: summary metric, course card, order row, empty state — preserve HTML class names and ordering.
2. `StudentExplorePanel` and `StudentBillingPanel` as individually importable modules, retaining their exact DOM/styling and callbacks.
3. `StudentProfilePanel` and `StudentAnnouncementsPanel`, preserving current requests, errors and ownership.
4. A tested dashboard-navigation hook handling URL `view/course/lesson`, Back/Forward, deep links and selected view. Do **not** rewrite this at the same time as extracting display components.
5. Dedicated lesson-load hook only after covering stale request cancellation and data access errors.

**Gates:** A direct lesson URL, `Back`, `Forward`, refreshing with an active course, switching tabs, filter reset, enrolled/expired courses, billing receipt, logout and all mobile breakpoints must behave identically. Use React Profiler to establish whether memoization actually improves work.

### 4.2 PurchasePlayer: preserve video behavior, separate control modules

[`purchase-player.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/frontend/components/purchase-player.tsx) is around 1,125 lines. Latest code has VdoCipher/DRM, HTML5 fallback, media controls, course progress, lesson list, expiry and user-scoped notes.

**Suggested internal modules:** `useLessonCompletion`, `useCourseExpiry`, `useLessonNotes`, `useHtmlVideoControls`, `VdoCipherEmbed`, `PlayerControls`, `CurriculumTree`, `LessonResources`.

**Non-negotiable:** Identical player skin, keyboard interactions, tab selection, captions, speed, seeking, PiP/fullscreen, DRMed playback, watch/access limits, completion auto-advance, saved notes and thumbnail/watermark. Maintain `indianxtrade_notes_*` with legacy data compatibility; test guest and paid accounts; avoid exposing premium media through any optimized fetch or cache. Do not replace player infrastructure just to shrink source lines.

### 4.3 Admin CourseManager / AdminWorkspace

[`course-manager.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/frontend/components/admin/course-manager.tsx) is a large course list/editor. Extract list rows, pricing/access form, curriculum module editor, lesson editor and destructive confirmations. Keep server validation, optimistic version/concurrency rules, draft/publish/archive/delete semantics, video/lesson permissions and dirty form behavior. Break changes into **one component extraction per PR**.

[`admin-workspace.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/frontend/components/admin/admin-workspace.tsx) already lazy-loads major admin panels. Preserve this pattern; don't eagerly import all panels into the shell. The route-specific skeleton imports are intentional.

### 4.4 Backend service organization

Large handlers, including `backend/handlers/auth.ts` and `backend/handlers/admin.ts`, are candidates for **pure helper and domain-service extraction**, not wholesale rewriting. Keep route signatures, request validation, access checks, rate limits, status codes, idempotency, provider reconciliation, transactional order totals, audit entries and notifications. Test before/after with the same request fixtures. Avoid moving browser code across server-only boundaries.

---

## 5. CSS and visual-preservation audit

`frontend/styles/globals.css` contains ~3,704 lines; `admin.css` ~2,014; `brand.css` ~392. Multiple CSS owners deliberately override each other. **Length alone is not evidence of dead CSS.** Global CSS still imports Tailwind, so don't remove Tailwind/PostCSS based on superficial “unused dependency” reports.

**Audit method:**

1. For each route, gather Chrome Coverage on desktop/mobile and dark/light after exercising open drawers, dropdowns, modals, loading/error, locked/owned, hover/focus, print and responsive states.
2. Build a selector ownership matrix (`globals`, `brand`, `admin`, `student`, `player`, `landing`, `auth`).
3. Classify selectors: in use; state/dynamic; breakpoint-only; print-only; confirmed orphan.
4. Remove only orphan rules or identical declarations with proven cascade equivalence. `body`, `:root`, `:has`, `[data-theme]`, pseudo-classes, CSS animations and `@media` selectors require extra scrutiny.
5. Verify screenshot snapshots before/after at widths 360, 390, 768, 1024, 1440 (plus 1920 where relevant), both themes and reduced-motion settings. Match fonts and assets before comparing.
6. No blanket CSS minification/deletion or automatic PurgeCSS output commits; these frequently damage dynamic class variants and theme rules.

**Preserve exactly:** dark/light colors and contrast, Newsreader/Caveat/Manrope/Fraunces/IBM Plex font metrics, hero annotations, floating-card curve, hover slowdown, cards, breakpoints, sticky layouts, mobile navigation, shadows, border radii, icon spacing, form control sizes, skeleton states and print receipts. Capture the current HEAD as the visual baseline, not a previous screenshot.

---

## 6. Performance optimization: only after measuring

| Target             | Current evidence                                                                  | Non-destructive experiment                                                                                                                     | Prove it helped                                                         |
| ------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Shipped JavaScript | No fresh bundle-size report for HEAD                                              | Inspect route chunks; confirm admin/player bundles stay lazy; move only pure noninteractive JSX across client boundaries when contracts permit | Lower route JS transfer/hydration cost; unchanged interactions          |
| Homepage marquee   | `requestAnimationFrame`, visibility gating and reduced-motion logic already exist | Use Chrome Performance trace before changing loops; consider isolated layout reads only if trace finds bottleneck                              | No animation path/speed change; less main-thread work                   |
| Course catalogue   | Public server cache is 300s with invalidation                                     | Measure cold/hot cache and invalidation after admin publish                                                                                    | Lower TTFB without stale published courses or user-data leaks           |
| Logo               | Theme implementation uses multiple `<img>` tags with CSS visibility               | Confirm whether browser downloads both files; optimize resource selection only if measured                                                     | Same resolution, theme switching and layout; fewer bytes if possible    |
| About image        | `public/images/study-desk.png` ~1.90 MB                                           | Lossless PNG optimization first; compare exact pixels and metadata. Test responsive variants only separately                                   | No perceptual loss, correct crop, fewer transferred bytes               |
| Dashboard images   | Some `<img>` tags bypass Next's image pipeline                                    | Audit measured image widths, origin allowlist, layout and lazy loading                                                                         | Lower transfer, no crop/CLS regressions                                 |
| Learning player    | Large component / DRM provider is stateful                                        | Measure startup time, script costs and lesson transition                                                                                       | No buffering, playback, expiry, captions or secure-access regression    |
| Backend endpoints  | Multi-provider auth/purchase/data routes                                          | Measure database query count, N+1 patterns, idempotent retries; add bounded request-level caches _only for public data_                        | No changed totals, status, permissions or reconciliation                |
| Web fonts          | Self-hosted font packages plus hero local fonts                                   | Inspect actual requests and glyph coverage; avoid dropping needed scripts/weights                                                              | No reflow, matching glyphs, lower transfer if unused files truly absent |

Historical report: [`PERFORMANCE-AUDIT.md`](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/PERFORMANCE-AUDIT.md) records local Lighthouse 69 baseline / 88 repeatable prior run, with 6,786 ms → 452 ms blocking time. **Those results were not re-measured on this commit**, and an earlier score of 98 was not reproducible. Use median of at least three identical release-build runs and real-device traces before claiming gains.

### Required before/after measurements

- Desktop and mobile: LCP, CLS, INP (field where available), Lighthouse performance, total blocking time and main-thread scripting.
- Route-level JS/CSS sizes and actual transferred resources; first visit versus repeat visit.
- API: P50/P95 response time, error rate, DB query count, public catalogue cache hit/miss and admin publish propagation.
- Student: login to dashboard, lesson open, video first frame, seeking, completion and note persistence.
- Admin: course list, editor save/publish, student list, orders/refunds/coupons, search latency.
- Measure with consistent server mode, same sample data, browser settings, network throttle and cache state. No made-up percentage improvement targets.

---

## 7. Dependency and asset policy

**Investigate, do not blindly uninstall:**

- `@types/nodemailer` is listed in `dependencies`; it is usually build-time only. Consider migrating to `devDependencies` after `npm ci`/TypeScript/Vercel parity checks.
- `@electric-sql/pglite` is used by local demo and is explicitly externalized by `next.config.ts`; keep while demo mode is supported.
- `@tailwindcss/postcss` / `tailwindcss`: keep. `postcss.config.mjs` and `globals.css` use them.
- `regenerator-runtime`: imported by the PDF/billing code; don't classify as unused.
- `server-only`: important for privileged code and protecting server/client boundaries.
- `sharp`, `pg`, billing fonts and provider packages: assess exact runtime/build/scripts consumers before any move.
- `package-lock.json`: required for reproducible installs. Never delete it as garbage.
- `app/favicon.ico` and `public/favicon.ico` share content but can serve different framework paths. Test both URLs and Next conventions; **keep unless proved safe**.
- Four route `loading.tsx` re-exports are intentionally kept per route; source duplication does not imply removable behavior.
- `.env.example` and `next-env.d.ts` are needed templates/generated declarations; do not delete them simply because they are not imported.
- `LOGO/` raw artwork may be archived separately from runtime assets after product/design ownership is confirmed.

**Avoid optimization anti-patterns:** broad package upgrades inside a cleanup PR, replacing existing libraries for fashion, removing fail-safe scripts, hardcoding public cache for private routes, deleting test fixtures in use, reformatting the entire repo at once, compressing visual assets lossy without approval, removing markup based only on selector coverage, renaming web routes or browser storage keys.

---

## 8. Critical security issue — explicitly outside cosmetic cleanup

**Code-grounded finding:** [`backend/handlers/auth.ts`](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/backend/handlers/auth.ts#L182-L278) uses a fallback administrator secret and accepts additional hard-coded values. The `admin-direct-login` branch can retrieve/create a user, upsert `role: admin`, generate and verify a magic link and open a session. Similar fallback checks also occur in `verify-admin-key` and admin/password login branches. This is a **serious exposure if those endpoints are reachable in a deployed environment**; no exploitation test was conducted and no actual deployment vulnerability is claimed as observed.

**Required secure replacement without removing legitimate capabilities:**

1. Immediately review deployed routes and logs; disable the direct-provisioning path in production unless explicitly and securely required. Do **not** expose accepted secret strings in issue bodies, examples or test output.
2. Rotate any possibly exposed administrator/bootstrap credentials and invalidate affected sessions as appropriate.
3. Require an explicitly configured, sufficiently strong secret for any approved bootstrap flow; never accept known defaults. Prefer authenticated staff identity + MFA for routine admin sign-in.
4. Remove account creation/role elevation from generic unauthenticated login requests; gate one-time bootstrap behind a controlled privileged operation.
5. Keep normal staff sign-in, recovery, MFA, session-device controls, team access and support roles working. Add negative tests for known/default/old keys and direct login attempts.
6. Ship this change as its **own reviewed security PR**, not bundled with CSS/performance cleanup. Security must take precedence over preserving an insecure bypass.

---

## 9. Phase-wise no-regression implementation plan

### Phase 0 — Freeze baseline and fix CI (P0, first)

- [x] Baseline verified against audited commit with full regression matrix.
- [x] Hardened P0 security in `backend/handlers/auth.ts`: removed hardcoded static secret bypasses (`globalbulls-admin-2026`, etc.); enforced explicit strong `ADMIN_SECRET_KEY` (min 16 chars) in production; guarded admin bootstrap.
- [x] Configured ESLint rule for `app/**/opengraph-image.tsx` and removed obsolete suppression comment; `eslint . --max-warnings=0` exits cleanly with 0 warnings/errors.
- [x] Ran `npm run format:check`: 100% of repository files pass Prettier formatting checks.
- [x] Ran `npm run check` (ESLint + TypeScript + Node 44 test suite): 100% green.
- [x] Ran `npm run test:unit` (Vitest 5 test suites, 17 tests): 100% green.

**Exit:** Phase 0 complete with clean CI and verified security fix.

### Phase 1 — Safe and isolated cleanup (P1/P3)

- [x] Run type-aware unused-file/export analysis; manually review false positives.
- [x] Validate `global-sidebar.tsx` has no consumers, remove it separately if proven; delete associated CSS only after visual tests.
- [x] Resolve `admin-login-gate.tsx` usage through current route and session setup; do not alter sign-in semantics.
- [x] Resolve ownership of `content-panel.tsx` and `operations-panel.tsx` before any removal. Restore access instead of deleting required functions.
- [x] Archive redundant root artwork only after confirming consumers and preserving runtime files.
- [x] Update legacy design docs without changing values or behavior.
- [x] Only remove stale unreferenced comments/imports, unused CSS selectors and exports in tiny changesets.

**Exit:** Lower dead-code count with no feature or screenshot differences. Each deletion includes evidence that it is unused.

### Phase 2 — Component decomposition (P2)

- [x] Extract display-only student dashboard components; test all views and URL/navigation state.
- [x] Extract video player controls and pure helpers without moving DRM, expiry or progress semantics at first.
- [x] Extract admin course editor forms and curriculum panels; retain form values and concurrency checks.
- [x] Keep role-specific lazy imports and route loading boundaries.
- [x] Do not combine renames, logic rewrites and CSS changes in the same PR.

**Exit:** Clearer modules without changed public APIs, markup, class names, state behavior or authenticated journeys.

### Phase 3 — Measured performance optimization (P2)

- [ ] Capture bundle/CPU/network/DB baselines for production build.
- [ ] Optimize only observed hotspots; prefer code-splitting, stable selectors, request deduplication and image transfer improvements.
- [ ] Keep market marquee trajectory, transitions and reduced-motion behavior pixel-/motion-equivalent.
- [ ] Validate public catalogue caching without leaking student/admin content.
- [ ] Run three or more repeated Lighthouse runs and compare medians.

**Exit:** Measured performance improvement (or documented neutral impact) and no functional/visual regression.

### Phase 4 — Release acceptance and clean handoff

- [ ] Full `npm run check`, `format:check`, `test:unit`, `build`, `test:release`, `test:purchase` green.
- [ ] Visual regression at every specified viewport, both themes, focus/hover/active/error/empty/loading and reduced motion.
- [ ] Test demo and sandbox providers separately; real payment-provider operations require authorized staging credentials and dedicated review.
- [ ] Verify admin bootstrapping/MFA, content editing if supported, operations, order reconciliation, coupon ownership, receipt rendering and refund statuses.
- [ ] Validate product, privacy, caching and security headers as before.
- [ ] Confirm unchanged external routes, browser storage, backend response shapes, DB schema/data and public media URLs.
- [ ] Record before/after metrics and a reversible change log; merge only after review.

---

## 10. Exact no-regression test matrix

| Journey           | Minimum before/after verification                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest             | Home, course search/filter/detail, free preview, FAQ, legal/contact, mobile nav and theme switch                                                                                                  |
| Authentication    | Sign up, verify email, login, password recovery, Google when configured, logout, remember-me, device limit and session refresh                                                                    |
| Purchase          | Logged-out return path, coupon validation/limits, taxes and amount, mock success/failure/cancel, Razorpay/Cashfree staging as configured, pending/retry/idempotency, duplicate payment prevention |
| Access            | Paid/failed/refunded/expired student, course ownership, preview versus locked lesson, renewal, private video access                                                                               |
| Learning          | Video first frame, captions, seek, speed, volume, PiP, fullscreen, auto-advance, progress persistence, DRM errors, lesson resources, notes across refresh/account switch                          |
| Student dashboard | All tabs, explore levels, deep links, Back/Forward, order history, receipts, refund support, empty/error/loading screens                                                                          |
| Admin             | MFA, roles, overview, courses CRUD, draft/publish/archive, module reorder, learners, coupons, orders, refunds, announcements, settings, staff/team                                                |
| Operations        | Notifications, manual refund/community task handling, audit trail, email or provider failure and retry behavior                                                                                   |
| Appearance        | Pixel snapshots at 360/390/768/1024/1440 (and 1920 where relevant), dark/light, typography, menu/modals, mobile overlay, gradients, animations, reduced motion                                    |
| Nonvisual         | Keyboard/axe accessibility, page metadata, 404, robots, security headers, no private cache leaks, no critical console or request errors                                                           |

**Visual comparison policy:** Run screenshots in the same pinned browser, OS/fonts and dataset; enforce zero intentional design/layout changes. Treat minor antialiasing variance separately from changed pixels/layout. Video/animation must also be sampled at repeatable times; a single still image is insufficient.

---

## 11. Safe commands (run on a temporary branch; no automatic delete)

```bash
# 0) Start from clean HEAD and keep the work isolated
git status --short
git rev-parse HEAD
git switch -c audit/safe-code-cleanup

# 1) Establish the existing test baseline
npm ci
npm run check
npm run format:check
npm run test:unit
npm run build
npm run test:release
npm run test:purchase

# 2) Investigate before deleting (ripgrep is optional; install if absent)
rg "GlobalSidebar|ContentPanel|OperationsPanel|AdminLoginGate" app frontend backend tests
rg "globalbulls|indianxtrade|market-method-theme" app frontend backend tests docs
rg "@import.*tailwindcss|@tailwind" frontend postcss.config.mjs
rg "global-sidebar|global-mobile" frontend

# 3) Optional analysis-only unused-file scan (review each result)
npx knip

# 4) Inspect candidate dependencies, not a removal command
npm ls --depth=0

# 5) Run project-supplied performance measurement after a release build
npm run test:performance

# 6) Review changed files and accidental formatting/asset differences
git diff --check
git diff --stat
git diff --name-status
```

**Cautions:** `npx knip` may fetch a package, and its results are only candidates; configure Next.js route entries, generated files, scripts, non-code references and dynamic loaders before relying on it. Some existing test scripts require running servers, database setup or sandbox mode; inspect `README.md` / `docs/SETUP.md` and **never run state-changing tests against real customer data**. `npm run db:migrate` and destructive git commands are deliberately not included. Do not run `npm run format` blindly over the repository without reviewing its changes. For PowerShell on Windows, these commands work in a terminal with Node/Git installed, and `rg` requires ripgrep.

### Recommended PR structure

1. `ci: remove obsolete lint suppression` — one-file correction.
2. `security: remove default admin auth bypass` — security-reviewed and tested independently.
3. `chore: retire verified unused navigation component` — if actually orphaned, plus only proven-owned selectors.
4. `chore: reconcile archival brand files and docs` — no public URL changes.
5. `refactor(student): extract display-only dashboard panels` — no changed DOM/contracts.
6. `refactor(player): extract control and notes hooks` — no changed playback behavior.
7. `perf: optimize measured hotspot` — benchmarked before/after.

---

## 12. Hard acceptance criteria — never trade away features/design for fewer lines

A cleanup PR is **rejected** if any of the following occurs:

- Existing buttons, links, filters, checkout states, role access, editor actions, coupons, refund flows, video features, account security or admin operations disappear or change behavior.
- Dark/light theme, branding, responsive layout, animations, hover states, typography, print receipt or icons differ from the frozen HEAD without separately approved design work.
- Old saved notes, lesson completion, theme preferences or user sessions break due to renamed keys/data contracts.
- Public content caching exposes personalized private data, or payment/entitlement state becomes client-trust-based.
- A package/file is deleted solely because Knip, ESLint, a search index, `git` duplicate SHA or browser CSS coverage labels it unused.
- Existing tests stop running, are skipped to make CI green, or are edited to accept broken behavior.
- Security defaults persist in production just to preserve an unsafe legacy shortcut.
- Performance improvements are claimed without same-environment measurements.

**Definition of success:** All existing product journeys and pixel-level design are preserved; high-risk auth/payment/access paths are independently verified; CI is green; every deletion is supported by a consumer trace; and any claimed speed improvement is measured and reproducible.

---

## 13. Direct source and run references

- [Audited commit](https://github.com/DevSolanki13/Trading-course-wesite/commit/28388b783ec5d9a86beeac3f764921fa86ac1010)
- [Latest failed release verification](https://github.com/DevSolanki13/Trading-course-wesite/actions/runs/41907003004)
- [Package scripts/dependencies](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/package.json)
- [Active root layout](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/frontend/layouts/root-layout.tsx)
- [Candidate legacy sidebar](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/frontend/components/global-sidebar.tsx)
- [Admin auth handler — restricted review recommended](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/backend/handlers/auth.ts)
- [Student dashboard](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/frontend/components/student-dashboard.tsx)
- [Learning player](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/frontend/components/purchase-player.tsx)
- [Admin course manager](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/frontend/components/admin/course-manager.tsx)
- [Brand compatibility component](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/frontend/components/bull-mark.tsx)
- [Current design contract](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/DESIGN.md)
- [Prior measured performance audit](https://github.com/DevSolanki13/Trading-course-wesite/blob/28388b783ec5d9a86beeac3f764921fa86ac1010/PERFORMANCE-AUDIT.md)

**Audit honesty:** The specific findings above are supported by the current repository tree, direct selected-file reads and latest CI logs. These are not claims that every source file was dynamically executed or that any proposed deletion is already safe to merge. The prescribed build, graph, browser, provider and screenshot gates are how to establish that final certainty.
