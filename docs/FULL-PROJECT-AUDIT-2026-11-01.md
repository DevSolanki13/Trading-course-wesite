# Full project test and issue report

**Test date:** 1 November 2026  
**Code checked:** `8634235` and the working tree at the start of this audit  
**Reference:** [Project architecture](./ARCHITECTURE.md)  
**Environment:** Windows, Node 22.19.0, npm 11.16.0, Next.js 16.4.3.

## Follow-up: Supabase certificate configured

**Updated 1 November 2026 after the certificate was supplied.** The original test results below remain a record of the initial audit. This follow-up supersedes the certificate blocker in issue 02.

- The local configuration now uses the supplied database CA certificate. Certificate verification remains enabled.
- `npm run db:verify -- --connection-only` **passed**. The staging database connection, matching project target, and auth schema were verified.
- Full database verification now reaches the migration checks and fails with `MIGRATION_LEDGER_MISMATCH`, rather than the certificate error.
- Migrations 001–006 have matching recorded checksums. Migrations 007–011 have no entries in the migration history.
- A separate read-only schema inspection found the demo creation function already present, but the commerce and purchase creation functions, billing documents, commerce jobs, purchase access table, course access-period column, and enrollment-expiry column were absent. This means the database cannot yet support all features in the current application code. Missing history does not mean every migration is completely unapplied; inspect existing objects before deciding how to update it.
- The operations check reported **one stalled refund**, **one published test course**, and **two retryable notifications**. It found zero invalid purchase-access records, paid orders without enrollment, invalid totals, exhausted notifications, expired notification leases, or unprocessed webhooks in its checks.
- No hosted schema, migration history, refund, course, or notification records were changed. Cashfree setup remains deferred.

**Next technical step:** compare the existing staging schema with migrations 007–011 and prepare a reviewed update/reconciliation plan. Do not replay migrations or add history entries just to make checks pass. Investigate the flagged records before taking action on them. No further certificate download or credential reset is needed for the connection that passed.

## Overall result

The main local browsing and test-purchase journeys work. The project is **not ready to be treated as a fully tested live course shop**. There are payment-flow mismatches, missing links in the buyer journey, misleading public content, and blocked external checks.

This report records problems found by running tests, using a browser, sending local test requests, testing a disposable database, and reading the code. It does not claim that every possible bug has been found. Real payment, email, Google login, and protected video acceptance still need separate checks.

No application fixes were made. No live payment, refund, email, deployment, or shared database change was performed. Extra test accounts and purchases were created only in the disposable local test database.

### How to read this report

- **High:** can stop a purchase, hide important buyer information, or seriously mislead users. Fix before opening sales.
- **Medium:** can break a normal action or make recovery difficult.
- **Low:** a smaller usability or clarity problem.
- **Reproduced:** seen in a test, browser, request, or disposable database.
- **Code-confirmed:** the problem is visible in the code, but the complete external journey was not run.
- **Blocked:** a check could not finish. This does not prove the related service is broken.
- **Risk:** a possible problem that needs the listed follow-up test.

## Checks that were run

| Check                                   | Result                              | What it tells us                                                                                                                                                                                                        |
| --------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                          | Passed                              | No reported lint errors.                                                                                                                                                                                                |
| `npm run typecheck`                     | Passed                              | TypeScript check passed.                                                                                                                                                                                                |
| `npm run format:check`                  | Passed before this report was added | Existing tracked files matched the formatter.                                                                                                                                                                           |
| `npm test`                              | 41 passed                           | Backend rules and disposable database tests passed.                                                                                                                                                                     |
| `npm run test:unit`                     | 10 passed in 3 files                | Existing catalogue and payment/status component tests passed.                                                                                                                                                           |
| `npm run build`                         | Passed                              | Production application compiled.                                                                                                                                                                                        |
| `npm run test:release`                  | 32 passed                           | Chromium tests passed on desktop/mobile, in light/dark themes, with synthetic service configuration.                                                                                                                    |
| `npm run test:purchase`                 | 4 passed                            | Local signup, purchase success/failure/cancel, ownership, receipt, progress, and layout checks passed.                                                                                                                  |
| `npm run test:playwright`               | 1 failed                            | Older homepage test expects text that no longer exists. Used the local production server through `PLAYWRIGHT_BASE_URL`.                                                                                                 |
| Additional component probes             | 4 passed                            | Confirmed the homepage content mismatch, notes loading error, enabled publish button after failed loading, and guest completion redirect. These tests demonstrate defects; passing does not mean the defects are fixed. |
| Additional local request/browser probes | Issues reproduced                   | Covered duplicate signup, weak local password, cookie duration, progress throttling, missing refund entry, and failed-network sign-out.                                                                                 |
| Additional disposable database probes   | Issues reproduced                   | Confirmed hidden Cashfree history and acceptance of a published course with no lessons by the purchase function.                                                                                                        |
| Additional responsive sweep             | No horizontal page overflow found   | Checked 15 public/error/recovery routes at widths 320, 768, and 1920 pixels. This is a layout check, not a complete usability pass.                                                                                     |
| Homepage internal links                 | No HTTP errors found                | Checked the unique internal page links present on the synthetic homepage.                                                                                                                                               |
| `npm run test:performance`              | Failed twice                        | Mobile performance scores were 75 and 79; project target is 90.                                                                                                                                                         |
| `npm run env:check`                     | Failed                              | Cashfree client ID and secret are missing. Other services had configuration values; connectivity was not proved.                                                                                                        |
| `npm run db:verify`                     | Blocked                             | `SELF_SIGNED_CERT_IN_CHAIN`.                                                                                                                                                                                            |
| `npm run ops:check`                     | Blocked                             | Same certificate error; remote migration and queue checks could not run.                                                                                                                                                |

The release suite uses fake/unavailable service values on purpose. It proves public rendering and safe rejection of requests. It does **not** prove real signup, real payment, staff actions, or video playback.

### Useful local evidence

- [Release browser results](../artifacts/phase-6/playwright.json)
- [Release browser HTML report](../artifacts/phase-6/playwright/index.html)
- [Purchase browser HTML report](../artifacts/purchase/playwright/index.html)
- [Latest performance summary](../artifacts/phase-6/lighthouse-summary.json)
- [Latest performance HTML report](../artifacts/phase-6/lighthouse.report.html)
- [Remote operations result](../artifacts/phase-6/operations.json)

These generated files are ignored by Git and may be replaced by future test runs. Browser traces can contain disposable session details; do not publish them as public evidence.

## Issues and flags

### 01. Cashfree cannot be tested with the current credentials

**High launch blocker · Reproduced configuration failure**

`env:check` reports missing `CASHFREE_CLIENT_ID` and `CASHFREE_CLIENT_SECRET`. A real Cashfree sandbox checkout could not be accepted end to end.

**User impact:** payment readiness is unproved. A configured video/email/Google flag does not change this.

**Next step:** configure the intended sandbox merchant, then test payment success, failure, cancellation, late confirmation, duplicate webhook delivery, and refunds. Live sales need their own acceptance.

Source: [Environment checks](../backend/config/environment.ts), [Cashfree adapter](../backend/payments/cashfree.ts).

### 02. Remote database and operations verification is blocked

**High verification blocker · Reproduced environment failure**

Both read-only commands stop with `SELF_SIGNED_CERT_IN_CHAIN`.

**User impact:** this audit cannot confirm that the hosted database has the required migrations, correct permissions, or healthy payment/refund/email queues. Local SQL tests are not proof of hosted database health.

**Next step:** repair certificate trust using the intended database CA/trust configuration, then rerun both commands. Keep certificate verification enabled. Do not assume this means browser-to-Supabase requests have the same failure.

Source: [Database connection checks](../backend/scripts/database-target.mjs), [Database verifier](../backend/scripts/verify-database.mjs), [Operations verifier](../backend/scripts/operations-check.mjs).

### 03. Cashfree's Buy now link uses the wrong course identifier

**High · Code-confirmed**

The course page passes `course.id` into the buy action. That action builds `/checkout/<UUID>`. The Cashfree branch of checkout searches the `slug` column using that value.

**Reproduce after sandbox setup:** open a published course, click Buy now, sign in, and continue. A UUID is searched as a slug, so the course is not found. Manually using `/checkout/<actual-slug>` takes a different path.

**Fix:** use one agreed identifier for public checkout links and lookups. Test the actual button journey, including the login return.

Source: [Buy action](../frontend/components/course-access-action.tsx), [Course detail](../frontend/pages/course-detail-page.tsx), [Checkout route](../app/checkout/[slug]/page.tsx).

### 04. Cashfree orders disappear from the new purchase history

**High · Reproduced in a disposable database**

The dashboard history calls `purchase_read`. That function returns only orders whose `purchase_provider` is not null. Cashfree orders use the older commerce path and leave this column null.

**Evidence:** a synthetic buyer had one paid Cashfree-style order. The course ownership check returned `true`, while the purchase-history function returned zero orders.

**User impact:** a buyer can see their course but no matching purchase in the dashboard. This makes receipts, status checks, and support harder to find.

**Fix:** combine provider histories behind one buyer-facing order list. Include existing Cashfree/demo purchases as regression cases.

Source: [Purchase history route](../app/dashboard/orders/page.tsx), [Purchase reads](../backend/purchase/repository.ts), [Current purchase SQL](../backend/database/migrations/202610310011_course_access_expiry.sql).

### 05. Course pages can show a different price from checkout

**Medium · Code-confirmed**

The non-local public catalogue reads `price_paise`. Purchase checkout uses `sale_price_paise` when present. Cashfree order creation also uses the sale price.

**Reproduce:** set a base price and a lower sale price on a published course. Compare its public card/detail with checkout.

**User impact:** visitors do not see the effective offer until later. This can look like a pricing mistake.

**Fix:** share the effective-price rule across cards, details, checkout, and saved orders. Clearly show any original price and tax treatment.

Source: [Public catalogue](../backend/public/catalogue.ts), [Purchase catalogue SQL](../backend/database/migrations/202610310011_course_access_expiry.sql).

### 06. The default dashboard does not lead buyers to refunds or community access

**High · Reproduced for the local dashboard; code-confirmed for the shared dashboard UI**

The dashboard and its purchase history have no refund-request control or link to the older learning library's Orders/Community sections. Those features live under `/learn` in configured service mode. The header sends signed-in desktop users to `/dashboard`.

**User impact:** a buyer following the visible account journey may never discover how to request a refund or join the student community. In local mode, `/learn` redirects back to the dashboard, so these features are not available there at all.

**Fix:** make refunds, billing, community, account settings, and course access reachable from one clear account navigation. Label local-only limitations.

Source: [Dashboard](../frontend/components/purchase-dashboard.tsx), [Learning library](../frontend/components/learning-library.tsx), [Header](../frontend/components/site-header.tsx), [Learning entry route](../app/learn/page.tsx).

### 07. Razorpay refund review is not connected to a refund submission flow

**High · Code-confirmed**

The new provider supports payment verification and observing completed refunds. The staff refund-processing route handles Cashfree sandbox orders only. There is no Razorpay refund-creation method in the provider contract.

**User impact:** staff can review/approve a refund, but the application has no corresponding Razorpay submission action. A provider-dashboard/manual process would need to be explicitly defined and tested.

**Fix:** implement the submission/retry/reconciliation flow or document and expose a clear manual process. Approval must not be presented as money returned.

Source: [Payment providers](../backend/payments/providers.ts), [Admin handler](../backend/handlers/admin.ts), [Refund controls](../frontend/components/admin/refunds-panel.tsx).

### 08. The older learning library offers billing downloads that new providers do not create

**Medium · Code-confirmed**

The library shows billing PDF/HTML links for paid/refunded orders. The order-change function deliberately skips billing-document generation when `purchase_provider` is set. Mock/Razorpay purchases instead use the new printable receipt route.

**User impact:** a new-provider buyer visiting the older library can encounter a download link without a matching billing document.

**Fix:** choose the correct document link per order type or use one document interface for all providers.

Source: [Library document links](../frontend/components/learning-library.tsx), [Order-change SQL](../backend/database/migrations/202610310010_purchase_access.sql), [Document access](../backend/billing/access.ts).

### 09. Homepage ratings, quotes, and business claims are hardcoded

**High · Reproduced in the production browser and component probe**

The homepage displays “Rated 4.9/5 by 2,000+ students”, named learner quotes, “120+ Hours”, “10k+” trades, and a “TRUSTED BY TRADERS FROM” brand list. These are rendered directly from source. They do not depend on the admin's genuine-testimonial confirmation.

**User impact:** visitors can mistake unverified content for real reviews, business history, or relationships. A general preview banner does not explain these individual claims.

**Fix:** remove unverified claims or identify examples beside the claims. Publish approved evidence-backed content through the existing confirmation process.

Source: [Homepage](../frontend/pages/home-page.tsx), [Product facts and constraints](../PRODUCT.md).

### 10. Several admin homepage edits never appear publicly

**Medium · Reproduced in a component probe**

The admin editor saves hero title/accent/description, teaching copy, and approved learner quotes. The homepage uses hardcoded versions of those sections. Its `content` prop is used for FAQs, but not these other fields.

**Evidence:** rendering with a unique approved hero and quote still displayed the hardcoded hero and named sample quotes. The approved text was absent.

**User impact:** an administrator gets a successful publish message but visitors keep seeing old content.

**Fix:** connect the editable fields to their public sections. Add a save-to-public-page test.

Source: [Content editor](../frontend/components/admin/content-panel.tsx), [Homepage](../frontend/pages/home-page.tsx).

### 11. Database trouble or unpublished sample courses can fall back to old public content

**Medium · Code-confirmed; fallback also observed with synthetic release configuration**

The public catalogue catches service errors and returns an empty list. Page routes then substitute the sample courses. The detail route also falls back to a sample course whenever its slug is missing from live results.

**User impact:** an outage can look like a normal preview catalogue. A sample-matching course that staff unpublished can still have a public example detail page. Visitors are not given an explicit service-unavailable state.

**Fix:** distinguish an intentional preview from an empty catalogue, an unpublished course, and a failed database request. Keep samples behind an explicit preview mode.

Source: [Catalogue loader](../backend/public/catalogue.ts), [Catalogue route](../app/courses/page.tsx), [Course route](../app/courses/[slug]/page.tsx).

### 12. The homepage risk-course link does not match the local seeded course

**Medium · Code-confirmed**

The homepage exercise links to `/courses/risk-and-psychology`. The local seed creates `risk-psychology`. The old slug resolves to the sample detail rather than the seeded buyable course.

**User impact:** a local tester following the homepage link can land on a preview page with disabled purchase instead of the working local course.

**Fix:** derive the link from actual course data, or keep a deliberate slug redirect.

Source: [Homepage risk link](../frontend/pages/home-page.tsx), [Local seed](../backend/local/seed.ts), [Course fallback](../app/courses/[slug]/page.tsx).

### 13. Losing the connection during dashboard sign-out gives no useful feedback

**Medium · Reproduced in the browser**

The dashboard logout function handles an HTTP failure but does not catch a rejected network request.

**Reproduce:** intercept `/api/auth/logout` with a network failure, then click Sign out. The browser raises `Failed to fetch`; no useful sign-out error is shown and the user stays on the page.

**Fix:** catch network errors, show a clear retry message, and prevent repeated clicks while the request is running.

Source: [Dashboard logout](../frontend/components/purchase-dashboard.tsx).

### 14. Device-limit cancellation can look like a successful sign-out when it failed

**Medium · Code-confirmed**

“Cancel and sign out” on the device screen redirects to login after any completed fetch, without checking whether logout succeeded. A network failure is also uncaught.

**User impact:** a server error can leave the session active while the interface suggests the user left it.

**Fix:** check the response, catch connection failures, and redirect only after confirmed logout.

Source: [Device challenge](../frontend/components/device-challenge.tsx).

### 15. Local progress throttling reports a payment failure

**Medium · Reproduced with local API requests**

The local rate limiter allows ten calls per action in 15 minutes. The purchase handler does not recognise its ordinary error with `status: 429`.

**Evidence:** ten completion requests returned 200. The eleventh returned 503 with “Purchase is temporarily unavailable. Check your saved order before retrying.”

**User impact:** a learner marking lessons complete can be blocked and told to check a payment order, even though the problem is a progress rate limit. The limit is local-mode-specific.

**Fix:** preserve the 429 status, show when to retry, and choose a progress limit suited to normal lesson navigation.

Source: [Local limiter](../backend/local/auth.ts), [Purchase handler](../backend/handlers/purchase.ts).

### 16. Duplicate local signup is reported as a service outage

**Medium · Reproduced with local API requests**

Creating the same email twice returns 503 and “This action is temporarily unavailable.”

**User impact:** the person cannot tell whether to sign in, recover a password, or retry. Retrying the same signup does not resolve it.

**Fix:** return an intentional account-exists/recovery response consistent with the application's account-privacy policy.

Source: [Local signup](../backend/local/auth.ts), [Local auth handler](../backend/local/http.ts).

### 17. Remember me does not match local cookie behaviour

**Medium · Reproduced with local API requests**

Local login accepts the `remember` field but always creates a seven-day session and seven-day cookie. The UI offers “Remember me for 30 days”. An unchecked login still received a persistent seven-day cookie.

**User impact:** shared-device testers can remain signed in longer than expected; people selecting the option do not get the promised duration.

**Fix:** implement the stated local behaviour or clearly label and disable this unsupported local option.

Source: [Auth form](../frontend/components/auth-form.tsx), [Local handler](../backend/local/http.ts), [Local sessions](../backend/local/auth.ts).

### 18. Local signup accepts passwords that the form says are invalid

**Low · Reproduced with a local API request**

A twelve-letter lowercase-only password was accepted locally. The form tells users to include uppercase, lowercase, and a number; configured auth enforces those rules.

**User impact:** a successful local test gives the wrong expectation for the real signup journey.

**Fix:** share password validation between modes, apart from clearly identified demo accounts.

Source: [Local auth validation](../backend/local/http.ts), [Configured auth validation](../backend/handlers/auth.ts), [Auth form](../frontend/components/auth-form.tsx).

### 19. Local password limits disagree with the visible form

**Medium · Code-confirmed**

The form permits up to 128 characters. Local auth permits at most 72 characters and rejects passwords over 72 UTF-8 bytes. Some non-ASCII passwords hit the byte limit much sooner.

**User impact:** the browser accepts input that the server later rejects with an unexpected limit or generic field error.

**Fix:** show and enforce the correct limit for the active auth mode. Test long passwords and non-ASCII characters.

Source: [Password input](../frontend/components/auth-form.tsx), [Local validation](../backend/local/http.ts).

### 20. Local password-recovery links lead to an unsupported flow

**Medium · Code-confirmed**

The shared login form offers Forgot password. Local auth only implements login/signup/logout; recovery returns 503 because it needs configured authentication.

**User impact:** local users can follow the normal recovery interface into a feature that cannot complete. This is a demo limitation, not proof that configured recovery is broken.

**Fix:** explain the limitation before submission, or provide a safe local recovery method for test accounts.

Source: [Auth form](../frontend/components/auth-form.tsx), [Local auth actions](../backend/local/http.ts).

### 21. Purchase availability and refund/access wording do not follow the active mode/settings

**Medium · Code-confirmed and visible in the browser**

The header and policy pages say enrolment/payments are unavailable. The public detail page says only simulated checkout is available whenever its buy flag is enabled, even if Razorpay is selected. Several public sections always describe seven days, 10%, and two devices, while admin settings allow different refund limits and one device.

**User impact:** the site can offer a payment action while saying no money can be collected, or explain rules that differ from the saved purchase terms.

**Fix:** make availability, provider-mode notices, access terms, and refund wording come from the same settings/snapshot. Review final policies before live sales.

Source: [Header](../frontend/components/site-header.tsx), [Course detail](../frontend/pages/course-detail-page.tsx), [Policy content](../frontend/content/legal.ts), [Admin validation](../backend/admin/validation.ts).

### 22. Coupons can be created but cannot be redeemed at checkout

**Medium product gap · Code-confirmed and explicitly marked deferred in the UI**

The admin can prepare coupon codes, but neither checkout form provides a coupon entry/redemption journey.

**User impact:** a published/shared discount code cannot be used. This should remain clearly described as unavailable until connected.

**Fix:** connect validation, limits, final totals, and order snapshots before distributing codes.

Source: [Coupon panel](../frontend/components/admin/coupons-panel.tsx), [Purchase checkout](../frontend/components/purchase-checkout.tsx), [Cashfree/demo checkout](../frontend/components/checkout-form.tsx).

### 23. Lesson notes keep saying Loading after the request has failed

**Medium · Reproduced in a component probe**

A failed notes request sets the page error but leaves `notes` as null. The notes section continues to show “Loading lesson notes…” and has no notes-specific retry control.

**User impact:** the learner cannot tell whether notes are still arriving, and may restart the whole classroom unnecessarily.

**Fix:** give notes their own loading/error state and retry action. Keep the working video usable.

Source: [Learning workspace](../frontend/components/learning-workspace.tsx).

### 24. Admin publishing remains enabled when the current content failed to load

**Medium · Reproduced in a component probe**

The content editor starts with an empty document and version 1. If loading fails, it displays an error but leaves “Publish content changes” enabled. It is also enabled while the initial request is pending.

**User impact:** staff can submit incomplete/default content without seeing the current copy. Version checks may reject it, but a matching initial version can allow an unintended replacement.

**Fix:** disable publishing until a successful initial load. Provide a retry action and preserve edits deliberately.

Source: [Content editor](../frontend/components/admin/content-panel.tsx).

### 25. Expired course access has no matching explanation on the destination page

**Medium · Code-confirmed**

The local lesson player redirects to a course with `?message=access-expired` at expiry. The course route only recognises `purchase-to-unlock`.

**User impact:** the video can stop and move the learner to a course page without explaining that access expired.

**Fix:** handle the expiry message and offer renewal plus access to the existing receipt/progress.

Source: [Local lesson player](../frontend/components/purchase-player.tsx), [Course route](../app/courses/[slug]/page.tsx).

### 26. Guest preview completion unexpectedly sends the visitor to login

**Low · Reproduced in a component probe**

A guest allowed to view a preview also sees “Mark as complete”. Clicking it calls a sign-in-only endpoint and then redirects to login without first explaining why.

**User impact:** a visitor trying the free lesson is interrupted by an unexpected account step.

**Fix:** label the guest action “Sign in to save progress” or explain that saving completion needs an account.

Source: [Learning controls](../frontend/components/learning-workspace.tsx), [Learning handler](../backend/handlers/learning.ts).

### 27. Advanced courses have no matching catalogue filter

**Low · Code-confirmed**

Admin course validation supports `advanced`, while the public filter only offers All levels, Beginner, and Intermediate. “All levels” is also used as an actual level on a sample course and cannot be selected independently.

**User impact:** learners cannot narrow the catalogue to all supported course levels.

**Fix:** derive filter options from supported levels and keep “all results” distinct from a course's difficulty label.

Source: [Catalogue filter](../frontend/pages/catalogue-page.tsx), [Course validation](../backend/admin/validation.ts), [Sample courses](../frontend/content/courses.ts).

### 28. The risk exercise calculates values that its own input marks invalid

**Low · Reproduced in the production browser**

The account-size input declares a minimum of 1,000, but its change handler permits zero and smaller positive values. Entering 500 showed a risk budget of ₹5 while browser validity reported `rangeUnderflow: true`. Clearing and typing 50000 left the displayed value as `050000`.

**User impact:** the exercise gives no explanation of its valid range and is awkward to edit.

**Fix:** allow a temporary empty editing state, normalise on blur, and either enforce or remove the stated minimum/step rules.

Source: [Risk exercise](../frontend/components/risk-exercise.tsx).

### 29. Homepage market examples contain confusing generated percentages

**Low · Reproduced in the production browser**

Ticker percentages are built from the item index. The repeated set displays values such as `+3.10%`, `−1.11%`, and `+3.13%`. The second set repeats content for animation without being hidden from screen readers.

**User impact:** the supposedly repeating ticker changes values, and assistive technology reads the duplicated sequence. The data is labelled as sample, so this is a clarity/accessibility issue rather than a live-feed failure.

**Fix:** use explicit sample values and hide visual-only duplicate items from assistive technology.

Source: [Homepage ticker and marquee](../frontend/pages/home-page.tsx).

### 30. The older homepage browser test is out of date

**Medium test-maintenance issue · Reproduced failure**

`npm run test:playwright` fails looking for a heading containing “Clarity before”. The current heading is “Learn to trade with clarity and confidence.” The test also expects an older “Explore courses” link. The document title still uses the old wording.

**User impact:** this command cannot give a useful clean regression result for the current homepage. Passing the newer release suite does not repair the older test.

**Fix:** update the expected public journey and keep meaningful navigation/theme assertions. Decide whether the old or new test command is the supported entry point.

Source: [Older homepage test](../tests/browser/home.spec.ts), [Homepage](../frontend/pages/home-page.tsx), [Homepage route metadata](../app/page.tsx).

### 31. Mobile performance misses the project's target

**Medium · Reproduced in two Lighthouse runs**

| Measure                   | First run    | Second run   |
| ------------------------- | ------------ | ------------ |
| Performance score         | 75/100       | 79/100       |
| Accessibility score       | 100/100      | 100/100      |
| Largest content appearing | 1.52 seconds | 1.35 seconds |
| Layout movement score     | 0.084        | 0.084        |
| Total blocking time       | 1,028 ms     | 777 ms       |

The command requires performance of at least 90, accessibility 100, largest content within 2 seconds, and layout movement at most 0.1. Performance failed in both runs. The second run was after the purchase suite finished. Local machine load still affects laboratory results.

**User impact:** on a slower phone the page can appear before controls become responsive. The first run also reported about 4.9 seconds of main-thread work and 11 long tasks.

**Fix:** inspect the Lighthouse report, reduce startup JavaScript and expensive layout/animation work, and test again under the same conditions. These runs do not measure real-user interaction delay or hosted performance.

Source: [Performance command and targets](../backend/scripts/measure-performance.mjs), [Latest results](../artifacts/phase-6/lighthouse-summary.json).

## Additional risks that still need a targeted test

These are not claimed as completed end-to-end reproductions.

### R1. An email link can be consumed before provider verification succeeds

**Potential impact: High**

The confirmation handler marks the link consumed before asking Supabase to verify it. If that provider step fails temporarily, the same link cannot be retried.

**Test next:** simulate a transient provider failure after claiming the link, then retry it. Provide a safe recovery/reissue path without weakening one-time-link protection.

Source: [Confirmation handler](../backend/handlers/auth.ts).

### R2. Signup email failure has no direct resend journey

**Potential impact: Medium**

Signup returns a generic inbox message even when delivery fails. That protects account privacy, but the form has no direct resend-verification action. A failed or expired signup link can strand a new learner; repeating signup against an existing unconfirmed account needs verification with the real provider.

**Test next:** fail initial email delivery, expire a signup link, and check how the learner gets another valid message. Preserve non-enumerating responses.

Source: [Signup handler](../backend/handlers/auth.ts), [Auth email](../backend/auth/email.ts), [Auth form](../frontend/components/auth-form.tsx).

### R3. The last few seconds of video progress can be lost on navigation

**Potential impact: Medium**

Protected playback sends periodic heartbeats. On page hide it pauses the video, but there is no explicit final durable progress flush. Cleanup also prevents queued work after the component becomes inactive.

**Test next:** close/navigate away just before a heartbeat, refresh, and compare resume position and watched time. Include a mobile browser being backgrounded or killed.

Source: [Protected player](../frontend/components/protected-player.tsx).

### R4. A failed or very slow player request can leave an action waiting too long

**Potential impact: Medium**

Several client fetch helpers have no request deadline. The protected player's heartbeat queue also waits for earlier requests. An indefinitely pending request can leave a loading state or queue without a clear recovery point.

**Test next:** hold checkout, lesson-start, and heartbeat responses open instead of returning an error. Verify visible timeout/retry behaviour and safe payment-status recovery.

Source: [Learning fetch helper](../frontend/lib/learning-api.ts), [Protected player](../frontend/components/protected-player.tsx), [Purchase checkout](../frontend/components/purchase-checkout.tsx).

### R5. New-provider checkout does not check for a usable paid curriculum

**Potential impact: Medium**

The disposable SQL probe created a mock purchase order for a published course with no lessons. The Cashfree creation path checks for paid lesson duration; the newer purchase path does not. Normal admin publishing prevents a fully empty course, but data imports/operator changes and all-preview courses still need protection.

**Test next:** use an all-preview published course, missing lesson assets, and imported inconsistent data. Checkout should refuse a course that has no usable paid content.

Source: [Purchase order SQL](../backend/database/migrations/202610310010_purchase_access.sql), [Cashfree order SQL](../backend/database/migrations/202610310011_course_access_expiry.sql).

### R6. Payment recovery and background processing differ between providers

**Potential impact: High before live sales**

Cashfree has background jobs. The newer Razorpay flow relies on browser verification and provider webhook delivery. The included operations worker processes Cashfree sandbox jobs only and is explicitly disabled outside staging. No schedule is declared in the hosting configuration; an external schedule may exist, but was not checked.

**Test next:** lose the browser response after payment, delay/drop webhooks, lose an order-creation response, and restart the server. Verify that one saved order eventually settles without a second charge. Confirm a documented production scheduler/reconciliation and email retry arrangement.

Source: [Purchase service](../backend/purchase/service.ts), [Provider adapter](../backend/payments/providers.ts), [Operations worker](../backend/operations/worker.ts), [Operations policy](../backend/operations/policy.ts), [Hosting configuration](../vercel.json).

### R7. Expired course access is not consistently considered by community operations

**Potential impact: Medium**

The admin task loader labels qualifying access using active, non-revoked paid enrollments, but does not select or check their expiry. The latest `admin_mutate` definition also has a simpler task-completion branch than earlier migration safeguards.

**Test next:** create a removal task, let the learner's remaining paid access expire, and refresh operations. Also test repurchase between loading a task and marking it done. Confirm staff do not remove a newly eligible learner or keep an ineligible learner because of stale evidence.

Source: [Admin task loader](../backend/handlers/admin.ts), [Latest admin mutation SQL](../backend/database/migrations/202610310011_course_access_expiry.sql).

### R8. A loading error can leave admin screens looking unfinished

**Potential impact: Low to Medium**

Several admin panels show a loading message whenever data is null, including after a request failure. Some retain error text after a later successful request. Switching editor tabs or admin sections can also discard unsaved form input without a warning.

**Test next:** fail and retry initial settings/overview loads; edit without saving and switch sections. Check that the message accurately describes the state and important edits are not silently lost.

Source: [Settings panel](../frontend/components/admin/settings-panel.tsx), [Overview panel](../frontend/components/admin/overview-panel.tsx), [Course manager](../frontend/components/admin/course-manager.tsx), [Admin navigation](../frontend/components/admin/admin-workspace.tsx).

## What was confirmed working

- Public home, catalogue, course detail, about, contact, and policy routes rendered in the release suite.
- Catalogue search, difficulty selection, no-results reset, theme persistence, mobile navigation, and preview-dialog keyboard focus passed their existing tests.
- The tested public pages had no automated WCAG A/AA violations in the release suite. The tested local checkout/dashboard/player screens also passed their accessibility checks. This is not a complete manual accessibility certification.
- Anonymous private API calls were denied, cross-origin mutations were rejected, and disabled payment endpoints did not grant access.
- Production content-security-policy checks, request-specific nonces, private caching rules, sitemap exclusions, social image, and unknown public-page checks passed.
- The local purchase journey returned to checkout after login, settled a simulated payment, provided a printable receipt, opened a lesson, saved completion, and showed 25% progress after navigation.
- Local failed/cancelled payments did not enroll the test learner. Tampered payment amounts and client-supplied signup roles were rejected.
- Disposable SQL tests covered permissions, immutable paid totals, duplicate settlement, access grants, expiry boundaries, progress rules, refund boundaries, worker claims, and rollback behaviour.
- Finite access and renewal rules passed the existing SQL tests, including month-end dates. This does not prove hosted migration rollout or physical-device playback at expiry.

## Coverage gaps and edge cases to finish before sales

The following checklist identifies unfinished verification. An unchecked item means **not proved in this audit**, not automatically broken.

### Accounts and sign-in

- [ ] Complete real email signup, verify inbox arrival, confirm the link, and return to the intended checkout.
- [ ] Test duplicate signup for an existing confirmed and unconfirmed address with configured auth.
- [ ] Test missing, expired, already-used, and temporarily failed email links.
- [ ] Complete Google consent, cancellation, callback failure, and checkout return.
- [ ] Complete real recovery/password change; verify old sessions stop working.
- [ ] Compare remember-me on/off across browser restarts in configured mode.
- [ ] Hit the device limit, replace one device, revoke the current device, and sign out all devices in real browser sessions.
- [ ] Test staff/support role boundaries, MFA setup and failure, lost-authenticator recovery, and permission changes during an active session.
- [ ] Test phone/email/name whitespace, long values, Unicode, pasted passwords, and password-manager autofill on actual browsers.

### Payments, refunds, and documents

- [ ] Complete Cashfree's actual Buy now → login/signup → checkout → provider → confirmation → lesson journey after fixing identifiers.
- [ ] Complete the selected real-provider test-mode journey; test UPI/card/mobile back-button behaviour where supported.
- [ ] Test two checkout tabs, fast repeated clicks, refresh during creation, network loss after charging, and delayed webhook arrival.
- [ ] Confirm old saved orders remain understandable after course title, price, tax, or provider settings change.
- [ ] Verify paid, failed, pending, cancelled, refunded, and expired purchases appear in the same visible account journey.
- [ ] Request and process refunds with the real intended provider; inspect the original payment method and receipt/credit-note results.
- [ ] Test just before, exactly at, and just after the refund time/watch limits through the browser and hosted database. Local boundary tests already pass.
- [ ] Refund one course while another valid course remains; test renewal and refund of an older purchase together.
- [ ] Check receipt ownership, large/Unicode names, tax settings, print layout, and old-provider documents on the hosted environment.
- [ ] Test coupon expiry, last remaining use, duplicate use, two simultaneous redemptions, and a discount reaching the minimum payable amount once coupon checkout exists.

### Learning and access

- [ ] Play actual protected lessons on Chrome/Android and Safari/iPhone. Chromium mobile emulation is not a physical phone or Safari test.
- [ ] Verify watermark, captions, fullscreen, allowed speed/quality controls, and keyboard access in the real provider iframe.
- [ ] Test expired OTP, rejected domain, provider script blocked by an extension, offline startup, and video becoming unavailable.
- [ ] Resume after refresh, tab close, backgrounding, seeking, repeated viewing, and two simultaneous players.
- [ ] Let course access expire during playback and while paused; compare browser clock changes with server enforcement.
- [ ] Revoke/block access during a lesson and confirm the next protected request/heartbeat stops access correctly.
- [ ] Change/unpublish/archive a course with existing buyers and inspect their dashboard, old receipt, and lesson links.
- [ ] Test removed/reordered lessons, empty modules, all-preview courses, resource failures, and completion at 0%/100%.

### Admin, operations, and launch content

- [ ] Verify hosted migrations and permissions after certificate trust is fixed.
- [ ] Test two staff members editing the same course/settings/content and confirm stale saves have an understandable recovery path.
- [ ] Test failed initial loads, failed saves, retries, page refresh during save, and unsaved-edit navigation.
- [ ] Verify upload interruption, invalid video IDs, encoding delay, wrong duration, and publish protection against real video assets.
- [ ] Confirm email sender/domain approval and delivery/retry evidence without sending to unauthorised recipients.
- [ ] Confirm the scheduler, pending-order reconciliation, failed emails, refund alerts, queue exhaustion, and backup/restore process in the intended hosting setup.
- [ ] Test sufficiently large order/student/refund lists and export limits with realistic synthetic data. Load/concurrency testing was not run.
- [ ] Supply approved instructor identity, support contact, business details, real reviews, final policies, and genuine community links. A visitor must have a working way to get help.
- [ ] Review policy text and public promises against the actual provider, access period, refund rules, and support process.
- [ ] Test Firefox, Safari/WebKit, physical mobile devices, 200%/400% zoom, screen readers, high contrast, and normal/reduced motion. The automated browser suites here used Chromium with reduced motion.
- [ ] Run a fresh dependency vulnerability/advisory check and a deployed security review. No claim about dependency vulnerability status is made by this audit.

## Suggested repair order

1. Fix Cashfree identifier handling, unified order history, and the buyer's refund/billing navigation.
2. Restore trusted remote database verification and complete the chosen provider's sandbox acceptance.
3. Remove unverified public claims and connect the admin-managed homepage content.
4. Make prices, policy wording, payment mode notices, support, and access rules consistent.
5. Fix network-error recovery, local auth mismatches, notes errors, and admin initial-load protection.
6. Update the outdated homepage test and add regression tests for the confirmed cross-provider defects.
7. Improve mobile startup performance and finish the external/device/operations checklist.

**Release decision:** local preview testing is largely successful. Live sales should wait for the high-impact issues and external acceptance gates above.

## Resolution log

The following non-Cashfree findings were resolved after the audit, with TypeScript, lint, unit,
and backend regression checks run after the changes:

- **12. Homepage risk-course link** — completed. The exercise now prefers the active seeded
  `risk-psychology` course while retaining the preview catalogue slug when that is the available
  source.
- **13. Dashboard sign-out recovery** — completed. Network failures are surfaced and repeated
  clicks are blocked while sign-out is pending.
- **14. Device-limit sign-out recovery** — completed. Redirect happens only after a successful
  logout response; failures remain visible on the device screen.
- **15. Progress throttle error** — completed. Client-visible 4xx rate-limit responses retain their
  status and retry message instead of becoming a payment-shaped 503.
- **16. Duplicate local signup** — completed. Duplicate local accounts return an explicit
  sign-in/password-recovery response.
- **17. Local remember-me behavior** — completed. Unchecked local sessions use a browser session
  cookie and checked sessions use the stated 30-day duration.
- **18. Local signup password rules** — completed. Local signup now enforces uppercase, lowercase,
  numeric, and minimum-length requirements.
- **23. Lesson notes failure state** — completed. Notes have independent loading, error, and retry
  states without preventing the lesson player from working.
- **24. Admin content load protection** — completed. Publishing and content additions stay disabled
  until the initial document loads, with a retry action on failure.
- **25. Expired access explanation** — completed. The course route explains expiry and points
  learners toward renewal and purchase history.
- **26. Guest preview completion** — completed. Guests are shown “Sign in to save progress” and
  are sent to login with a return path.
- **27. Advanced catalogue filter** — completed. Filter options are derived from supported course
  levels rather than a hardcoded incomplete list.
- **28. Risk exercise input** — completed. Editing permits an empty draft value and blur normalizes
  it to the declared range.
- **29. Sample ticker accessibility** — completed. Values are explicit sample content and the
  repeated visual marquee sequence is hidden from assistive technology.
- **30. Homepage browser regression** — completed. The legacy test now asserts the current heading
  and course navigation while retaining theme persistence coverage. With the local server running,
  `npm run test:playwright` now passes.

Cashfree findings remain intentionally deferred by request: **01, 03, and 04**, plus Cashfree
portions of **08** and the provider-operation risks. Remote verification (**02**) remains open
for a separate staging/database pass.

Additional resolutions:

- **05. Effective course pricing** — completed. Public catalogue data now uses the saved sale
  price when present, matching purchase calculations.
- **06. Buyer navigation** — completed for the current purchase dashboard. Refund support, learning
  library/community access, course browsing, purchase history, and account/device management are
  now visible together; local mode keeps the service limitation explicit.
- **09. Unverified homepage claims** — completed. Unsupported ratings, named quotes, partner
  logos, learner counts, and trading-history numbers were removed.
- **10. Managed homepage content** — completed. Approved hero, description, teaching copy, and
  confirmed testimonials now drive their public sections.
- **11. Catalogue failure fallback** — completed. Database failure is now distinct from intentional
  preview mode, shows an availability message, and does not render stale sample detail pages.
- **07. Non-Cashfree refund review** — completed as an explicit manual-provider workflow. Admin
  screens now state that approval does not move money and identify when provider-dashboard/manual
  confirmation is required.
- **21. Fixed policy wording** — completed for public course/FAQ copy. Course access, device,
  and refund language now refers to the active policy and saved purchase terms rather than fixed
  seven-day, 10%, and two-device claims.
- **19. Local password limit** — completed. The local server accepts the form’s character range,
  reports the bcrypt byte limit explicitly, and the local form caps the visible password length
  accordingly.
- **20. Local password recovery** — completed as an explicit limitation. The local form explains
  that recovery is unavailable in demo mode and the endpoint returns a dedicated actionable
  message instead of a generic outage.

Feature delivery:

- **Course-specific admin learner progress dashboard** — completed for local demo and configured
  production/staging code paths. The new role-guarded course learner query returns only enrolled
  learners for the selected course, with active/expired access, completion percentage, watched
  seconds, last activity, and lesson-level detail. The admin Courses panel now opens a searchable
  learner table and read-only learner detail view using the existing admin theme. Local `/admin`
  is enabled for the seeded administrator and includes a clearly labelled demo enrollment/progress
  fixture. Validation passed with `npm run lint`, `npm run typecheck`, `npm run test:unit`, and
  `git diff --check`; the local demo endpoint returned the seeded learner at 25% completion.
  Migration `202611010012_admin_course_learners.sql` still requires reviewed rollout on shared
  staging/production.

- **Paid enrollment and student access rule** — completed. Admin net revenue now reflects paid
  orders, enrolled-student counts use active paid enrollments only, and the local demo overview
  reads the same order totals. Student catalogue, lesson, completion, and learning-session access
  now require a matching active purchase enrollment with `orders.status='paid'`; pending, failed,
  cancelled, refunded, expired, and manual student enrollments cannot unlock paid lessons.
  Migration `202611010014_paid_student_access.sql` applies the access rule and migration
  `202611010015_paid_overview_counts.sql` applies the final overview count contract.

- **Course-specific historical pricing** — completed. The admin overview and local demo aggregate
  revenue from each paid order's stored total and course snapshot, not from one fixed global price
  or the course's current editable price. Future course price changes affect only new purchases;
  existing orders and receipts retain their original price.

- **Coupon checkout redemption** — completed. Admin-created percentage/fixed coupons can be
  course-scoped, expired, usage-limited, and per-student limited. Checkout asks for a coupon before
  payment, supports applying it or choosing “I don't have a coupon,” and displays the discounted
  total. Validation, reservation, redemption/release, and final totals are server-owned.
