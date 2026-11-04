# GlobalBulls — Production UI/UX Audit and Remediation Plan

**Review date:** 4 November 2026 (IST)  
**Repository:** https://github.com/DevSolanki13/Trading-course-wesite  
**Reviewed branch:** `main`  
**Pinned commit:** [`87a8c25ccafcd4954ecc5612c3b4029a2bd486cd`](https://github.com/DevSolanki13/Trading-course-wesite/commit/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd)  
**Application:** GlobalBulls — Next.js/React trading education and course-sales website  
**Scope:** Public visitor, prospect, first-time account holder, buyer, paid student, returning learner, support staff, and administrator; desktop/mobile; light/dark; accessibility, feedback, navigation, content accuracy, and production release readiness.

> **Evidence and limitations:** This is a **source-code and connected deployment/CI audit**, not a completed interactive live-user session. I inspected GitHub files at the pinned commit, the latest GitHub Actions job and Vercel deployment metadata. I **did not** complete live browser, actual bank-payment, or physical-device testing at this commit; network access to the deployed UI was not available in the review environment. Where behavior is logically established by code it is marked **Code-confirmed**. Other concerns are labelled **Needs verification**. This document does **not** assert that every visual defect has been observed on a real screen.

## 1. Executive decision

**Recommendation: NO-GO for a public, paid production launch until the P0 issues below are corrected and the complete release suite passes at the exact deployed commit.**

The application already has substantial functionality: catalogue, authentication, checkout, coupons, order receipts, access-expiry controls, lessons, progress, learning dashboards, admin course management and operations. The principal problem is not a need to replace its visual theme; it is **behavioral consistency and user trust** across those features.

### Verified current release status

- **GitHub Actions:** Latest [Release verification run](https://github.com/DevSolanki13/Trading-course-wesite/actions/runs/41842759106) **failed** at `npm run format:check`: Prettier reported **50 files** with formatting issues. `npm ci`, `npm run check` and `npm run test:unit` passed. The workflow **skipped** the production build, release Playwright tests and purchase Playwright tests; therefore this run does **not** certify the latest commit's buyer or mobile journeys.
- **Vercel:** Latest production deployment metadata reported **READY** for the same commit. [Deployment inspection](https://vercel.com/devs-projects-402f5056/trading-course-wesite/HPFvxvPYFKc3XmLap6w8UyFuY7Dp). A deploy marked READY does **not** override a failing quality gate or establish real-user functionality.
- **Production project domain identified:** `academy.indianxtrade.com`. Its rendered experience was **not** interactively tested as part of this audit.
- **Earlier audit:** [`docs/FULL-PROJECT-AUDIT-2026-11-01.md`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/docs/FULL-PROJECT-AUDIT-2026-11-01.md) documents tests and resolutions from earlier code. This report reviews **current source** rather than treating those older checks as a fresh pass; previously resolved items are **not** automatically counted as open.

### Priority definitions

| Priority                | Meaning                                                                                                                                   | Release rule                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **P0 — launch blocker** | Prevents fundamental navigation, breaks paid learner delivery, presents non-functional paid features, or leaves latest release unverified | Fix and demonstrate passing regression test before launch                                     |
| **P1 — high**           | Significantly harms trust, conversion, accessibility, recovery, or important staff tasks                                                  | Fix before accepting real customers; exception only with explicit owner approval and evidence |
| **P2 — medium**         | Reduces polish, consistency or discoverability; potentially impactful on edge cases                                                       | Address in launch hardening / shortly after P0–P1                                             |
| **V — verification**    | Cannot be proven from source alone                                                                                                        | Run specified test, then classify based on result                                             |

### Real-user journey summary

| Persona                          | Expected experience                                                          | Code-grounded concern                                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **New visitor**                  | Find courses, login, help and pricing easily                                 | Main header component exists but is not mounted; the global sidebar returns `null` for guests                                       |
| **Interested buyer**             | Understand the _actual_ price, access period, refund terms, and availability | Course pages contain contradictory preview/test/production claims and hard-coded policy language                                    |
| **Returning buyer**              | Resume a pending payment without accidentally starting another               | Some recovery links create fresh checkout attempts rather than prioritize checking pending orders                                   |
| **Paid learner**                 | “Start learning” opens the owned course immediately                          | Deep links set `course=` but dashboard defaults to Explore; lesson content can silently fall back to fake demo data                 |
| **Learner with poor connection** | Understand errors, retry videos and preserve progress/notes                  | API errors are swallowed and placeholder media may be shown; note-save description is inaccurate                                    |
| **Mobile learner/staff**         | See navigation to all workspace sections                                     | Shared mobile CSS hides the sidebar navigation groups without a clear replacement in these workspaces                               |
| **Administrator**                | Manage courses safely and recover from failures                              | Mobile tabs disappear, native destructive confirms lack context, some controls are inert, and overview error/loading states overlap |

---

## 2. P0 — Fix before any paid launch

### P0-01. Public navigation is missing for unauthenticated visitors

**Status:** Code-confirmed. **Surface:** Homepage, catalogue, login discovery, accessibility.

**Evidence:** [`RootLayout`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/layouts/root-layout.tsx) renders `GlobalSidebar`, content and footer, **not** `SiteHeader`. [`GlobalSidebar`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/global-sidebar.tsx#L24-L52) returns `null` for `!user` and hides itself on the landing page. [`SiteHeader`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/site-header.tsx) contains the guest-friendly navigation, theme toggle, mobile dialog and skip link but is not mounted in the active root layout.

**User impact:** Visitors may rely on hero links and footer to discover the course catalogue, authentication, or contact information. The `Skip to content` link within the unused component is absent from that layout.

**Fix:** Mount a **single active public header** for non-workspace pages (guests and signed-in storefront), with brand/home, Courses, Login / My learning, Contact/help, theme toggle and mobile navigation. Retain the sidebar only where appropriate. Avoid two simultaneous nav systems. Place a visible-on-focus `Skip to main content` at layout level and ensure each page has exactly one `id="main-content"`.

**Acceptance:** Fresh incognito visitor at `/`, `/courses`, `/courses/<slug>`, `/login` sees usable navigation at 360px and 1440px, keyboard Tab reaches all links and skip link, no duplicate nav, no content overlap.

### P0-02. Direct “Start learning” and free-preview links can land on Explore, not the course

**Status:** Code-confirmed. **Surface:** Purchase-success CTA, free lesson, course deep links, browser refresh.

**Evidence:** [`/learn/[slug]`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/app/learn/%5Bslug%5D/page.tsx) and [`/learn/[slug]/[lessonId]`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/app/learn/%5Bslug%5D/%5BlessonId%5D/page.tsx#L6-L13) redirect to `/dashboard?course=...`. [`app/dashboard/page.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/app/dashboard/page.tsx#L26-L45) defaults `initialView` to `explore` when there is no `view`/`tab` query. [`student-dashboard.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/student-dashboard.tsx#L510-L522) shows the player only when `view === "courses"`.

**User impact:** A successful paying learner or free-preview visitor can be dropped into a catalogue screen instead of the lesson they selected.

**Fix:** Whenever the route has a valid `course` query, choose `initialView = "courses"`. Prefer a canonical classroom route or an explicit `view=courses` in all redirects. Test refreshed, bookmarked and emailed links, owned/expired/guest paths, and `?lesson=`. Do **not** bypass entitlement checks.

**Acceptance:** From receipt/success page, clicking **Start learning** opens the intended course and first/resume lesson; a direct lesson URL opens that exact permitted lesson and back/forward still work.

### P0-03. Admin and student workspace navigation disappears at mobile widths

**Status:** Code-confirmed CSS/design-flow concern. **Surface:** Mobile student dashboard and admin.

**Evidence:** [`frontend/styles/admin.css`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/styles/admin.css#L429-L455) hides `.admin-nav-group` and `.admin-sidebar-bottom` under 900px. All principal [`admin navigation`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/admin/admin-workspace.tsx#L180-L238) and [`student navigation`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/student-dashboard.tsx#L351-L441) use these classes. No corresponding workspace mobile menu is rendered in those components.

**User impact:** Mobile users may be unable to switch between My courses / Explore / Billing / Profile or between admin management views.

**Fix:** Add a proper mobile workspace bar and accessible drawer or horizontally scrollable, clearly labelled nav. Ensure tab links remain keyboard-accessible, the drawer traps focus while open, Escape closes it, and body scroll is controlled. Reuse one responsive navigation design rather than CSS-hiding core features.

**Acceptance:** Every student and admin section can be reached and exited at 320/360/390/768/900px, including touch and keyboard; show screenshots in both themes.

### P0-04. Failed lesson API requests can be masked by fabricated learning content

**Status:** Code-confirmed. **Surface:** Paid classroom and free previews.

**Evidence:** [`student-dashboard.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/student-dashboard.tsx#L290-L327) does not verify `response.ok`, silently ignores fetch failures, and substitutes a generic market-structure lesson, `isDemo: true` and `/sample-lesson.mp4` when lesson content is unavailable. [`purchase-player.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-player.tsx#L589-L625) uses the same missing local media path as a fallback. At the pinned commit, the tracked `public/` tree does **not** contain `sample-lesson.mp4`.

**User impact:** A learner who paid for real instruction can see unrelated sample text/video, a broken playback, or fail to realize that the server is unavailable.

**Fix:** Model `loading | ready | unavailable | accessDenied | error` explicitly. Render player only after a valid response. On failure show **“We couldn't load this lesson”** + Retry + Contact support. Restrict sample content to clearly marked local/demo sessions using a real, tested media URL. Never show placeholder instructional content on a live paid route.

**Acceptance:** Simulated 401/403/404/500/offline responses display correct recovery states and **never** show fictitious content; paid content and correct lesson ID load normally in staging.

### P0-05. “Resources (2)” offers fake PDF downloads

**Status:** Code-confirmed. **Surface:** Learning player/resources tab.

**Evidence:** [`purchase-player.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-player.tsx#L856-L968) hardcodes a resources count of two, PDF titles, sizes, and download links that call `preventDefault()` and only display a downloading toast; no download is started.

**User impact:** Students reasonably believe paid supplemental resources exist and will download. The action promises a result it does not deliver.

**Fix:** Read legitimate course/lesson resources from server data with entitlement checks, show actual filenames and sizes, use secure working links, handle expired access and download failures. If none, show **“No resources for this lesson yet”** with no fake count or button.

**Acceptance:** Download button retrieves the advertised file with correct content type, or an honest empty/error state appears. No success/progress toast without actual download.

### P0-06. Pending payment recovery may lead to another new checkout attempt

**Status:** Code-confirmed UX path; **double-charge outcome needs verification**. **Surface:** Razorpay checkout, pending orders, order history.

**Evidence:** [`purchase-checkout.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-checkout.tsx#L91-L145) calls the `create` order action each time Pay is retried, including after a window dismissal. [`student-dashboard.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/student-dashboard.tsx#L1223-L1246) presents **Retry checkout** for every non-paid order including `pending`. The [`confirmation page`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-confirmation.tsx#L47-L57) correctly says to avoid paying twice, but recovery paths are inconsistent.

**User impact:** Customers may make repeated attempts for an unsettled transaction and lose track of which order they actually paid. This is not evidence that money was charged twice, but must be guarded.

**Fix:** Use a stable idempotency key and server-side pending-order reconciliation. Separate **Check payment status**, **Resume this order**, and **Start a new payment**. Show each order's current state plus a help path if money was debited but access is locked. Respect provider state; never grant access on a client-only success event.

**Acceptance:** Closing popup, reloading, returning later and repeated clicks never create uncontrolled parallel active orders; payment can be reconciled from webhooks/API; status eventually resolves to paid/failed/cancelled or offers support.

### P0-07. Latest commit is not release-test certified

**Status:** CI-confirmed. **Surface:** Production process, all journeys.

**Evidence:** [GitHub Actions run `41842759106`](https://github.com/DevSolanki13/Trading-course-wesite/actions/runs/41842759106) reported **50 Prettier warnings**, then skipped `npm run build`, `npm run test:release`, and `npm run test:purchase`.

**User impact:** A READY deployment can contain untested regressions in checkout or student flow.

**Fix:** Run Prettier on a reviewed branch, inspect diff, commit only intended formatting, then require passing lint/typecheck/unit/build/release Playwright/purchase Playwright on the same SHA before promoting production. Make GitHub required checks or Vercel Deployment Checks part of the release gate.

**Acceptance:** CI green including screenshots/traces of buyer, classroom and mobile admin views; reviewed production deployment corresponds to tested SHA. Formatting alone does **not** fix functional issues P0-01–06.

---

## 3. P1 — Serious trust, accessibility, reliability and operational issues

### P1-01. Production, preview and simulated-payment copy contradict the active payment mode

**Status:** Code-confirmed.  
**Where:** [`course-detail-page.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/pages/course-detail-page.tsx#L86-L99), [`course route`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/app/courses/%5Bslug%5D/page.tsx#L35-L65), [`auth-page.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/pages/auth-page.tsx#L60-L67), [`site-footer.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/site-footer.tsx#L39-L55).

`demoEnabled` on the course page is also set when the regular payment provider is available. The same branch then tells users **“Only simulated checkout is available; no money is collected.”** The login page says enrolment is not open; footer says brand/policies remain provisional. All are inappropriate in an approved paid mode.

**Fix:** Introduce an explicit server-derived `salesMode: 'preview' | 'demo' | 'sandbox' | 'live' | 'unavailable'`, and use it for every CTA, price label, disclaimer and support message. Do not infer a simulated mode from mere provider availability. Publish only approved legal/instructor copy when real sales are enabled. **Test each mode separately.**

### P1-02. Refund promise is hard-coded despite configurable policy

**Status:** Code-confirmed.  
**Where:** [`course-detail-page.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/pages/course-detail-page.tsx#L257-L271), [`admin settings`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/admin/settings-panel.tsx#L121-L158).

Published purchase cards promise **seven days / less than 10% watched**, regardless of settings. **Fix:** Server-render the active policy (or policy version) alongside checkout and save immutable terms with orders; use dynamic public policy or link to authoritative terms. For policies not yet verified, do not present a precise numeric guarantee. **Acceptance:** Changing a staging policy changes new public-page and checkout copy consistently without changing existing order terms.

### P1-03. Published course pricing is still called “illustrative”

**Status:** Code-confirmed.  
**Where:** [`course-detail-page.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/pages/course-detail-page.tsx#L213-L232), [`mobile purchase bar`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/pages/course-detail-page.tsx#L295-L315), [`course-card.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/course-card.tsx#L53-L75).

**Fix:** For live published courses label it **Course price** or **Price**. Show tax basis and discount clearly. Keep _Illustrative_ only for intentional preview fixtures, and make sure the final charged value is always visible before authorization. **Acceptance:** Catalogue → detail → checkout → receipt use equivalent product/price semantics and accurate taxes.

### P1-04. Paid curriculum and instructor copy still reads like an unfinished prototype

**Status:** Code-confirmed.  
**Where:** [`course-detail-page.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/pages/course-detail-page.tsx#L107-L171), [`site-footer.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/site-footer.tsx#L39-L55).

Page says planned recordings are unavailable and biography/trailer will publish before enrollment. **Fix:** Require an actual instructor identity, accurate lesson totals and accessible preview asset before enabling a paid course; suppress proposed/placeholder claims on genuine published pages. **Acceptance:** A buyer can view exactly what they will receive: instructor, learning objectives, language, runtime, last content update, eligibility, and access window.

### P1-05. Device restrictions and community benefits are contradictory

**Status:** Code-confirmed.  
**Where:** [`course-detail-page.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/pages/course-detail-page.tsx#L235-L258) promises two active devices and a planned private community; [`student-dashboard.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/student-dashboard.tsx#L1327-L1340) describes **single-device** playback; [`site.ts`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/content/site.ts) says follow active device limits.

**Fix:** Unify exact account device allowance, concurrent-playback rule and registered-device reset process in one policy. Separate promised included community access from a _planned_ feature; do not imply membership before delivery. **Acceptance:** Same terms on pricing page, FAQ, signup, account and DRM challenge.

### P1-06. Lesson notes claim automatic saving but require manual Save

**Status:** Code-confirmed.  
**Where:** [`purchase-player.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-player.tsx#L94-L106), [`saveNotes`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-player.tsx#L318-L326), [`notes UI`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-player.tsx#L903-L925).

Placeholder says **“automatically saved to your browser”**, but storage writes only on the Save button; there is no change-leave warning or cross-device sync. **Fix:** Either implement debounced autosave with `Saving… / Saved / Could not save` and exit protection, or explicitly say **“Notes are stored on this device when you click Save.”** Ideally implement user-scoped backend notes, with offline state and migration.

### P1-07. Browser-local notes are not scoped by account

**Status:** Code-confirmed privacy and UX concern.  
**Where:** [`purchase-player.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-player.tsx#L94-L106).

Storage uses `globalbulls_notes_${lesson.id}` with no user ID. On shared browsers, two accounts studying the same lesson may encounter each other's saved notes. **Fix:** Move to authenticated server storage, or at minimum namespace by logged-in user, document the local storage boundary and handle logout/account changes. **Acceptance:** Notes from learner A do not appear for learner B on the same browser.

### P1-08. Captions control advertises functionality it does not have

**Status:** Code-confirmed.  
**Where:** [`purchase-player.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-player.tsx#L705-L715), [`video track`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-player.tsx#L618-L625).

**Fix:** Implement real caption on/off for HTML video, with `aria-pressed`, and provide approved video-specific caption tracks. For DRM videos use supported provider caption APIs; otherwise remove inert custom button and rely on the provider UI. Hindi audio with English demo subtitles must be labeled accurately.

### P1-09. Video seek bar and centered Play are not keyboard-operable

**Status:** Code-confirmed.  
**Where:** [`purchase-player.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-player.tsx#L628-L650).

Seek bar and center Play use click-only `<div>` elements; mouse seek receives `MouseEvent<HTMLDivElement>`. **Fix:** Use semantic button for large Play and accessible `<input type="range">` or proper ARIA slider with arrow-key seek, labelled elapsed/total time, focus styling and touch targets of at least 44×44 CSS px where practical. **Acceptance:** All essential video operations are usable via keyboard only.

### P1-10. No actionable video playback error/retry state

**Status:** Code-confirmed UI implementation; exact runtime error needs verification.  
**Where:** [`purchase-player.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-player.tsx#L545-L650).

`onError` sets `videoError = true`, but the code hides controls rather than rendering a useful error and retry action for the local player. **Fix:** Display video unavailable reason where known, a Retry button that reloads authorized source, help link and preserved notes/progress. Add network-loss/DRM-token-expiry scenarios.

### P1-11. Generic learning outcomes appear on unrelated lessons

**Status:** Code-confirmed.  
**Where:** [`purchase-player.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-player.tsx#L868-L900).

All lessons display three fixed market-structure takeaways, regardless of topic. **Fix:** Add real per-lesson outcomes to the authoring schema and render only those; if absent, omit the section rather than inventing curriculum. **Acceptance:** Risk-psychology and market-foundations lessons display distinct correct outcomes.

### P1-12. “Lifetime access” appears when no expiry is available

**Status:** Code-confirmed.  
**Where:** [`purchase-player.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-player.tsx#L488-L496) versus [`site.ts`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/content/site.ts).

**Fix:** When `accessExpiresAt` is absent, show a neutral **“Access end date unavailable”** or the explicit server-confirmed access policy; never infer lifetime access. **Acceptance:** Test courses with active, expired, missing and invalid expiration values.

### P1-13. Related courses are taken from static illustrative fixtures

**Status:** Code-confirmed.  
**Where:** [`course-detail-page.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/pages/course-detail-page.tsx#L1-L6), [`related-courses`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/pages/course-detail-page.tsx#L282-L294).

**Fix:** Pass related courses from the same server-confirmed, published current catalogue as main course detail. Filter out unpublished, deleted and current course; show at most a few truly relevant options. **Acceptance:** Admin changes/unpublishes a course and related cards update without showing stale preview prices.

### P1-14. Admin overview can display “Loading…” permanently after request failure

**Status:** Code-confirmed state handling.  
**Where:** [`overview-panel.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/admin/overview-panel.tsx#L18-L55).

When fetch fails, `error` is set but `data` remains null, so the UI renders an error **and** loading message without retry. **Fix:** Explicit `idle/loading/success/empty/error` request state, retry button, clear stale error on date-range changes and preserve previous good metrics while refresh occurs. **Acceptance:** Mock 500/offline, retry to success, repeated range changes and empty data.

### P1-15. Admin course publishing and deletion lack a guided high-stakes confirmation

**Status:** Code-confirmed UX risk.  
**Where:** [`course-manager.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/admin/course-manager.tsx#L73-L95), [`course editing/destructive actions`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/admin/course-manager.tsx#L725-L787).

Native `window.confirm` gives limited information about enrollment, active buyers and deletion impact. **Fix:** Accessible confirmation dialog listing course name, status, enrolled students and consequences; require type-to-confirm for permanent deletion; block deletion when business rules require retention; distinguish Archive, Unpublish and Delete clearly. **Acceptance:** Keyboard-accessible confirmation with server-side safety checks and no accidental loss of paid learner access.

### P1-16. Direct course navigation and browser Back do not produce a reliable history trail

**Status:** Code-confirmed behavior, user impact needs browser test.  
**Where:** [`student-dashboard.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/student-dashboard.tsx#L103-L177), [`admin-workspace.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/admin/admin-workspace.tsx#L188-L204).

Student section and lesson changes use `window.history.replaceState` (so visited sections do not enter Back history). Admin tabs use local state only (no URL), so refresh resets to Courses. **Fix:** Use router-driven navigable URL state for significant view/lesson changes, and `replace` only for normalization. Test Back/Forward/refresh/bookmark at all levels.

### P1-17. Dashboard defaults to Explore even for paying learners

**Status:** Code-confirmed.  
**Where:** [`app/dashboard/page.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/app/dashboard/page.tsx#L25-L45).

**Fix:** For an authenticated learner with active purchases, default `/dashboard` to **My courses / Resume learning**. For a no-purchase learner, default to **Explore courses** with clear next step. Always honor explicit `view=` query. **Acceptance:** Paid returning user sees Resume above exploration; empty new learner sees relevant catalogue.

### P1-18. Some lesson navigation appears clickable even when a lesson is locked

**Status:** Code-confirmed UI affordance; server entitlements still need live verification.  
**Where:** [`purchase-player.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-player.tsx#L428-L480).

`isLocked` changes the icon but the lesson is still rendered as a normal link. **Fix:** A locked item should announce lock and show clear **Buy to unlock** / expiry action, not behave like an available lesson. Keep backend entitlement checks authoritative.

---

## 4. P2 — Cleanup that improves professional quality

| ID        | Issue and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Recommended solution                                                                                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P2-01** | The student Explore filter has fixed Beginner/Intermediate/Advanced options while stored courses can have other levels such as “All levels”. [`student-dashboard.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/student-dashboard.tsx#L1033-L1050)                                                                                                                                                                                    | Generate options from actual published catalogue values; normalize display labels; reset on empty results.                                                                                                    |
| **P2-02** | `Resources (2)` aside, lesson time UI substitutes arbitrary timings such as **12:30** and defaults a lesson to **12 min** when no metadata is ready. [`purchase-player.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-player.tsx#L699-L702)                                                                                                                                                                                  | Show `--:--` / “Loading duration” until media metadata loads; distinguish authored lesson duration from live player duration.                                                                                 |
| **P2-03** | Student Explore search field and level select lack explicit visible or screen-reader labels in code. [`student-dashboard.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/student-dashboard.tsx#L1033-L1051)                                                                                                                                                                                                                            | Add `<label>` or `aria-label`; keyboard and speech recognition tests.                                                                                                                                         |
| **P2-04** | Admin sidebar tabs use `role="tab"` without a tablist wrapper and full tab-panel/arrow-key pattern. Student/player tab patterns are incomplete. [`admin-workspace.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/admin/admin-workspace.tsx#L188-L205), [`purchase-player.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/purchase-player.tsx#L835-L868) | Use proper WAI-ARIA tabs (roving focus, `aria-controls`, `tabpanel`) or plain navigation buttons/links, rather than partially implemented tab semantics.                                                      |
| **P2-05** | “Admin workspace” switcher is a `<button>` without any action. [`admin-workspace.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/admin/admin-workspace.tsx#L208-L218)                                                                                                                                                                                                                                                                  | Implement an actual workspace chooser or replace with static status text. Never render fake interactive affordances.                                                                                          |
| **P2-06** | Admin course thumbnail is a `<div role="button">` with bespoke keyboard handlers. [`course-manager.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/admin/course-manager.tsx#L151-L169)                                                                                                                                                                                                                                                 | Use a native `<button type="button">` or link with a meaningful accessible name.                                                                                                                              |
| **P2-07** | Google sign-in remains visible but disabled even if Google is not enabled. [`auth-form.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/auth-form.tsx#L262-L295)                                                                                                                                                                                                                                                                        | Hide option/divider when unavailable or explain clearly **“Google sign-in is not available”**; do not present mystery-disabled CTA.                                                                           |
| **P2-08** | Account security link inside local student dashboard redirects to `/account`, which redirects back to `/dashboard` in local-demo mode. [`student-dashboard.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/student-dashboard.tsx#L1330-L1340), [`app/account/page.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/app/account/page.tsx)                                      | Show a demo limitation and hide unavailable device controls, or make destination functional in demo. Not necessarily a live-production issue.                                                                 |
| **P2-09** | “Contact instructor / mentor desk” links to generic `/contact?topic=learning`, but contact page does not visibly use topic to tailor UI. [`student-dashboard.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/student-dashboard.tsx#L1005-L1012), [`contact-page.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/pages/contact-page.tsx)                             | Prefill supported issue category or use a correct subject-line mailto; don't promise instructor access unless it exists.                                                                                      |
| **P2-10** | Course images use Next `<Image unoptimized>` and workspace images use raw `<img>`. [`course-card.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/course-card.tsx#L18-L31), [`course-detail-page.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/pages/course-detail-page.tsx#L80-L88)                                                                               | Check actual image sources/remote-pattern policy, use responsive sizes and optimized formats where allowed, lazy-load below fold, verify visual fidelity; measure current LCP rather than assume improvement. |
| **P2-11** | Homepage illustrative market percentages look like live ticker values; text makes them illustrative for assistive tech, not necessarily for sighted visitors. [`home-page.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/pages/home-page.tsx#L113-L136)                                                                                                                                                                                          | Add **“Illustrative figures — not live prices”** visibly near ticker or remove percentages. Do not render generated percentages resembling a market feed.                                                     |
| **P2-12** | Admin coupon editor asks for raw course ID rather than a searchable course picker. [`coupons-panel.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/admin/coupons-panel.tsx#L97-L107)                                                                                                                                                                                                                                                   | Choose course by title and show ID only as secondary metadata; validate course status and expiry/usage configuration.                                                                                         |
| **P2-13** | Admin screens have inconsistent error/load treatment; course list failed request can fall into an empty-looking state. [`course-manager.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/admin/course-manager.tsx#L43-L59)                                                                                                                                                                                                              | Shared loading/error/empty/success components; prominent Retry instead of “no courses” on failed fetch.                                                                                                       |
| **P2-14** | Profile menu and workspace menus advertise `role="menu"` but do not fully follow keyboard-menu interaction conventions. [`admin-workspace.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/admin/admin-workspace.tsx#L235-L327), [`site-header.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/site-header.tsx#L145-L222)                                 | Either use a Radix dropdown/menu with Escape, arrow keys, focus restore and roles, or simple disclosure semantics without incorrect `menu` role.                                                              |
| **P2-15** | UI state/inline styles mix branded tokens and hard-coded dark colors (`rgba(255,255,255,...)`, green hex), making light-mode contrast inconsistent. [`student-dashboard.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/components/student-dashboard.tsx#L448-L502), [`video-learning.css`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/frontend/styles/video-learning.css)               | Route semantic colors through existing tokens. Run light/dark visual regression and WCAG contrast checks without changing the brand identity.                                                                 |

---

## 5. Additional production verification gates (not proven failures)

These checks are essential **before enabling live payments**, but should not be presented as bugs until a targeted test shows failure.

| Gate                                         | Why it matters                                                                                                                                                                                          | Evidence required                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **V-01: Real gateway acceptance**            | Demo payments cannot prove actual capture, timeouts, browser closure, failed/retried requests or refund settlement                                                                                      | Sandbox end-to-end with provider-side order IDs, webhook retries, status reconciliation, receipt, no double grant                                      |
| **V-02: Remote database schema/migrations**  | Earlier audit documented a staging migration-ledger/schema mismatch                                                                                                                                     | Authorized read-only comparison, reviewed migration plan, exact production schema readiness, rollback plan; don't replay blindly                       |
| **V-03: Email/Google login**                 | Email links and OAuth must work on actual approved domain                                                                                                                                               | Real inbox tests for signup/verify/reset; repeat, expired, revoked tokens; Google OAuth exact callback and mobile Safari                               |
| **V-04: DRM player**                         | HTML5 demo player cannot validate paid VdoCipher playback                                                                                                                                               | Real enrolled device, unsupported browser, concurrent sessions, token expiry, network interruption, protected stream, captions                         |
| **V-05: Invoice/refund business compliance** | Payment receipts and published refund/GST policy create customer expectations                                                                                                                           | Policy/legal review, GST conditional display, historical price snapshots, all visible figures vs server order data                                     |
| **V-06: Speed/Core Web Vitals**              | Large media, complex CSS and client dashboards may affect mobile performance                                                                                                                            | Lighthouse/CrUX on **current deployed SHA**; target LCP <=2.5 s, INP <=200 ms, CLS <=0.1 at 75th percentile where data available; compare before/after |
| **V-07: Accessibility**                      | Automated axe is not enough for keyboard/video interactions                                                                                                                                             | WCAG 2.2 AA keyboard audit, focus, zoom 200/400%, reduced motion, labels, screen-reader announcements, captions                                        |
| **V-08: Public SEO/indexing**                | [`app/layout.tsx`](https://github.com/DevSolanki13/Trading-course-wesite/blob/87a8c25ccafcd4954ecc5612c3b4029a2bd486cd/app/layout.tsx#L12-L19) sets `noindex` unless production + `ALLOW_INDEXING=true` | Confirm intentional launch configuration, crawl rules, sitemap, canonical tags, structured data and marketing approval                                 |
| **V-09: Live support readiness**             | Customers must be able to resolve payment/access disputes                                                                                                                                               | Send support message from actual email, confirm response channel, categorize order ID, no password collection, SLA displayed only if staffed           |
| **V-10: Responsive regressions**             | Static CSS inspection cannot guarantee no visual overflow/overlap                                                                                                                                       | Real Chromium/Firefox/WebKit at 320/360/390/768/1024/1440/1920 and 200% zoom, screenshots dark/light                                                   |

### Guardrails for implementation

- Preserve existing **brand, layout style, theme tokens, animation character, course purchase functionality, server-side entitlement logic, and historical receipts** except where defects require a targeted change.
- **Do not** remove payment provider modes or rewrite the full application to fix navigation.
- Never allow a visually improved checkout to create paid access without server-confirmed captured payment.
- Preserve archived/order history and refund evidence while updating course management UX.
- Do not invent customer testimonials, instructor credentials, community availability, financial returns, download resources or course content.
- Use accessible semantic components, content-driven UI and shared loading/error/empty patterns; avoid stacking one-off CSS overrides.

---

## 6. Proposed phased implementation plan

### Phase 0 — Freeze scope and restore trustworthy CI

**Goal:** Know exactly what is being released.

1. Branch from the pinned reviewed SHA. Preserve original product functionality and current design.
2. Run `npm ci`, `npm run format:check` and inspect formatting-only diffs before committing them.
3. Make `npm run check`, `npm run test:unit`, `npm run build`, `npm run test:release` and `npm run test:purchase` required for production promotion.
4. Capture a before-state screenshot matrix and baseline Core Web Vitals. Never replace these baselines with estimates.

**Exit:** Same SHA passes all required build and browser stages; environment and test fixtures are isolated from real customers.

### Phase 1 — Restore purchase and learning journey **(P0)**

1. Fix guest/public header and skip navigation.
2. Fix `course=`/`lesson=` to load **My courses/classroom**, not Explore.
3. Restore mobile workspace navigation for both student and admin.
4. Replace fake player fallback and missing media with explicit content states.
5. Remove fake PDFs / download buttons or wire real protected resources.
6. Separate pending-order status checks from creating new payment orders; add idempotency/reconciliation tests.

**Exit:** Each persona can complete their critical journey on desktop/mobile; no fake content or non-functional paid download.

### Phase 2 — Trust and payment clarity **(P1)**

1. Consolidate `salesMode` and correct public CTA, test/production wording and price labels.
2. Derive refund terms/device rules from server-owned policy and show clear tax/discount.
3. Replace provisional instructor/curriculum claims with verified published content, or keep course unpublished.
4. Use current published data for related courses and dynamically derived filter options.
5. Make purchase history status-specific: **Check pending**, **Retry failed**, **View receipt**, **Access expired**.

**Exit:** The exact product, cost, access duration, and policy communicated before payment match the saved order and after-purchase UI.

### Phase 3 — Classroom quality and accessible operation **(P1/P2)**

1. Add playable/error/retry/DRM states without fake demo fallback.
2. Implement or remove caption control; keyboard-friendly seek and play.
3. Make lesson outcomes and resources lesson-specific.
4. Fix notes-save promise, multi-user isolation and save/error states.
5. Make expired/missing course access messaging consistent with policy.
6. Improve appropriate focus states, semantics, responsive typography and light-theme contrast.

**Exit:** Learners can complete an entire paid course on mobile and keyboard; failures are recoverable and content is accurate.

### Phase 4 — Admin and release hardening **(P1/P2/V)**

1. Add responsive admin navigation and URL-aware tab state.
2. Improve empty/error/retry states, destructive confirmation, coupon course picker, and staff focus control.
3. Add cross-provider acceptance, database migration audit, email, DRM and refund checks in staging.
4. Verify accessibility, browser/device matrix, performance budget and monitoring alerts.
5. Record launch approval including known limitations, support contact and rollback strategy.

**Exit:** No P0 open; P1 closed or explicitly risk-accepted; latest production commit and evidence match.

---

## 7. Automated and manual test plan

### Commands (from repository root, Node >=22.19)

```bash
npm ci

# First inspect what needs formatting; formatting changes must be reviewed.
npm run format:check
# Apply formatting only on a dedicated reviewed branch:
npm run format

npm run check
npm run format:check
npm run test:unit
npm run build

npx playwright install chromium
npm run test:release
npm run test:purchase
```

**Notes:**

- `npm run test:purchase` uses an isolated demo setup according to repo scripts; it is **not** proof of a real bank or merchant integration.
- Run payment provider acceptance with approved **sandbox keys and staging database**, never by issuing unreviewed production charges.
- Local release tests cover Chromium, dark/light and 390px/1440px; extend them to **320/360/768/1024px**, Firefox/WebKit and mobile device reality checks.
- Release test failure should **block deployment/promotion**; the recent workflow skips tests after formatting failure.

### Required E2E scenarios

| Test ID    | Persona / action                                              | Expected result                                                                            | Issues          |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------- |
| **E2E-01** | Guest opens home at 360px, finds Courses and Login            | Visible working nav, accessible focus and theme, no overlap                                | P0-01           |
| **E2E-02** | Guest selects a free lesson directly                          | Exact preview lesson opens (or clear unpublished explanation); no unrelated Explore screen | P0-02           |
| **E2E-03** | Student purchases via mock success                            | Correct price/policy, paid order/receipt; Start learning opens lesson                      | P0-02, P1-01–05 |
| **E2E-04** | Student pays, closes payment popup, returns via Orders        | Pending attempt can be checked/resumed; no uncontrolled duplicate active attempts          | P0-06           |
| **E2E-05** | Simulate lesson API 403, 404, 500 and offline                 | Correct accessible error/retry; no fabricated player/video                                 | P0-04           |
| **E2E-06** | Open resources on lesson with no attachments                  | Honest empty state, no fake PDF/download toast                                             | P0-05           |
| **E2E-07** | Open lesson with real attachment                              | Authorized download succeeds; unauthorized access fails                                    | P0-05           |
| **E2E-08** | 360px student changes My courses → Billing → Account          | All sections available by mobile nav; back/forward correct                                 | P0-03, P1-16    |
| **E2E-09** | 360px admin changes Courses → Orders → Refunds → Profile      | All sections usable, no clipped action/hidden navigation                                   | P0-03           |
| **E2E-10** | Keyboard-only playback and captions                           | Play/pause, seek, captions, speed and lesson navigation functional                         | P1-08–10        |
| **E2E-11** | Learner A saves notes, signs out; learner B opens same lesson | No notes leaked to B; save state accurate                                                  | P1-06–07        |
| **E2E-12** | Admin API overview fails then recovers                        | Error with Retry, never indefinite Loading; retry successful                               | P1-14           |
| **E2E-13** | Admin changes price/refund/device policy in staging           | Published page, checkout and new order terms aligned                                       | P1-01–05        |
| **E2E-14** | Learner course access expires during lesson                   | Video stops appropriately, route explains expiry and renewal                               | P1-12, V-04     |
| **E2E-15** | Buyer with refunded/failed/pending orders views history       | Correct state-specific action, never misleading Retry for pending                          | P0-06           |
| **E2E-16** | Admin tries to delete published course with enrollments       | Clear consequence warning and server protection, no accidental delete                      | P1-15           |
| **E2E-17** | Browse light/dark, reduced-motion and 200% zoom               | No inaccessible contrast, animation trap or horizontal loss of actions                     | V-07, V-10      |
| **E2E-18** | Real sandbox gateway callback/webhook retried and replayed    | Exactly-once entitlement; receipt/account recovery; no incorrect paid access               | V-01            |

### Suggested release-ready acceptance thresholds

- **0 open P0** defects.
- **All principal user journeys pass** at the latest commit (guest → checkout; signup/sign-in → checkout; pending → paid/failed; paid → lesson → progress → receipt; admin → publish/manage/refund).
- **0 fake UI actions** (download, captions, buttons, links) and **0 fabricated paid instructional content**.
- Every submitted action shows meaningful **loading, success, error, retry** feedback; destructive operations show consequences.
- **WCAG 2.2 AA** review for primary tasks; keyboard-accessible media controls and mobile nav.
- Current production build and staging payment/email/DRM acceptance verified; sign-off documented.
- Visual regression approved in dark/light on mobile/tablet/desktop, and measured performance budgets recorded.

---

## 8. Implementation checklist — copy into issue tracker

### Must fix first

- [ ] **P0-01** Mount functional guest/public navigation and skip link.
- [ ] **P0-02** Correct dashboard/course deep-link default so Start learning opens the lesson.
- [ ] **P0-03** Restore responsive student/admin workspace navigation.
- [ ] **P0-04** Remove silent fake classroom fallback; explicit API loading/error/retry.
- [ ] **P0-05** Replace fake lesson downloads with real resources or an empty state.
- [ ] **P0-06** Correct pending payment retry/idempotency and order recovery.
- [ ] **P0-07** Restore full passing release checks for current SHA.

### Finish before accepting paid customers

- [ ] **P1-01–05** Align payment mode, real price, refunds, instructor content, device/community promises.
- [ ] **P1-06–07** Correct notes saving and scope private notes to user.
- [ ] **P1-08–10** Implement captions, keyboard video controls, player error/retry.
- [ ] **P1-11–13** Remove fake outcomes/lifetime access, use real related courses.
- [ ] **P1-14–16** Repair admin recovery, destructive confirmations and navigation history.
- [ ] **P1-17–18** Prioritize My courses for paid learners and clarify locked lessons.
- [ ] **V-01–10** Complete release acceptance; no real money until verified.

### Polish and maintainability

- [ ] **P2-01–15** Dynamic filters, timing clarity, labels, menu semantics, sensible buttons, image optimization, responsive/light-theme checks.
- [ ] Add a regression test for each code-confirmed P0/P1 defect **before** declaring fixed.
- [ ] Update README/operations docs only after functionality and published copy match actual behavior.

---

## 9. Recommended task handoff for coding agent

> Review and resolve `GlobalBulls_Production_UI_UX_Audit_2026-11-04.md` using the pinned GitHub commit as a starting baseline. Work phase by phase, P0 before P1 before P2. For each issue: identify the exact cause, write an automated regression test where possible, implement the smallest safe fix, run the relevant tests, document files changed, note manual checks and show screenshots for UI changes. Preserve existing brand/theme/visual language and current features. Never replace paid content with demo placeholders, remove entitlement/payment safeguards, alter historical invoices, or make unapproved business/legal promises. Do not claim a fix is complete until it is verified. Do not run real payments or modify a shared production database without explicit authorization.

## 10. How to use this report

1. File P0-01 through P0-07 as separate tickets, with exact linked code and acceptance tests.
2. Implement Phase 1 on a branch; create fresh desktop and mobile screen captures from that branch.
3. Run the full test matrix and obtain QA evidence at the **same commit** intended for deployment.
4. After P0, tackle policy/content trust issues before cosmetic redesign.
5. Re-audit after fixes; this source inspection should not be mistaken for an exhaustive real-device production certification.

**Audit outcome:** Strong existing feature breadth; material UX trust and workflow blockers remain. **Current status: not ready to treat as a fully verified live paid course store.**
