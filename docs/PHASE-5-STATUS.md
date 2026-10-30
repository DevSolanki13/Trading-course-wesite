# Phase 5: operations, content and refund review

Updated: 30 October 2026, IST. **Phase 5 implementation and staging browser verification pass.** Cashfree onboarding and Phase 3 are deferred by the owner. This staging release cannot send a refund to a payment provider or declare an invoice final.

## Implemented scope

| Area | Current behavior and boundary |
| --- | --- |
| Team workspace | `/admin` requires an admitted Admin or Support session with a verified TOTP authenticator. Admin has all sections; Support can view overview, students, orders and refunds, manually grant a course, and make an ordinary refund review. Support cannot edit courses, prices, coupons, site copy, settings, staff, blocking, exports or exceptional goodwill decisions. `/admin/security` retains the existing MFA and Admin-managed Support invitation/removal tools. |
| Course builder | Admin can create/edit a draft, add ordered modules and lessons, reorder by drag or keyboard-accessible buttons, attach notes/text worksheets, check provider status, upload video via VdoCipher's authorised direct-to-storage policy, select a known test video and publish/unpublish. Publishing checks ready videos and matching duration. Published courses appear on public course pages, the catalogue, homepage and sitemap; adding course four needs no code change. No invented instructor identity or reviews are seeded. |
| Student operations | Search and inspect student profiles, purchases, progress, device sessions and grants. Support/Admin can add an audited manual grant to a published course. Admin can revoke access, block/unblock a student or sign out every student device. Staff accounts cannot be blocked through this screen. |
| Orders and reporting | Admin/Support can inspect order state and provider attempts, search/filter by IDs, course, status and IST date. Admin can download a CSV with spreadsheet-formula neutralisation; export is explicitly limited to the first 1,000 filtered rows. The overview uses database aggregation for today, this week, this month and all time in IST, including net/gross revenue, confirmed refunds, paid sales, new students, refund rate, a chart and course breakdown. Pending/failed payments are excluded. Only confirmed paid/refunded fixture data was used in testing. |
| Refund requests | A student can submit one request per paid order only when immutable purchased policy and per-order watched ranges pass the exact time/watch boundaries. Admin/Support see request-time and current evidence. Review checks current eligibility again and records actor, note, version and any Admin-only goodwill exception. Approval changes the request to `approved`; order remains `paid` and access remains until a separately verified provider settlement. A service-role-only, idempotent settlement function is reserved for the later Cashfree adapter; there is **no public/admin endpoint that simulates settlement**. |
| Refund consequences | When a verified provider adapter eventually confirms a refund, only that purchase enrollment is revoked. Other valid purchases or manual grants remain active. A private-community removal task appears only when no qualifying paid course remains. A human must remove the Telegram member and record completion; hiding an invite is insufficient. Provider failure keeps course access and marks the request failed. |
| Email notifications | Approval, rejection and confirmed-refund messages enter a durable outbox inside the same transaction as the state change. An explicit operator-only worker can send and retry them with provider idempotency keys; provider acceptance is tracked separately from inbox delivery. The worker is not scheduled and was not run against student recipients during implementation. Business sender verification remains required for general recipients. |
| Coupons | Admin can manage code, fixed or percentage amount, optional course scope, expiry, activation, total use limit and per-user limit. Checkout redemption/accounting is Phase 3; an enabled code currently grants no discount by itself. |
| Site copy and settings | Admin can edit landing copy, verified instructor details/portrait, FAQs, genuine testimonials, official community links, billing/tax settings, refund rules and the device cap (one or two, never above the promised maximum). The owner must assert that any quote or instructor detail is real and publishable. Device-cap reductions revoke excess older sessions. Settings are versioned; later changes do not rewrite paid-order snapshots. The final business, tax, policy and student content still require owner approval before sales. |
| Audit and security | Each Admin/Support mutation writes an audit entry in the same database transaction. Financial decisions also have immutable decision history. All mutations use strict server validation, an admitted session, database role and AAL2 enforcement; service-role RPCs are inaccessible to public/anonymous/authenticated REST clients. |

## Database and tests

[Migration 005](../backend/database/migrations/202610300005_admin_operations.sql) was applied transactionally to the configured staging project; applied migrations 001–004 were left unchanged. The remote verifier passed **five migration checksums, 26 RLS-protected tables, nine authentication RPCs, five learning RPCs and nine Admin/refund RPCs** with their restricted grants. The new refund watch ledger records unique watched intervals separately for each paid order, using server time and the frozen purchased lesson version.

[Migration 006](../backend/database/migrations/202610300006_refund_followup.sql) is now applied transactionally to staging. It adds deduplicated request-received and provider-failure notifications, prevents a stale Telegram-removal task from being closed after the learner gains qualifying paid access again, and caps the configurable device limit at two. The remote verifier passed six migration checksums, the device-cap constraint and the follow-up trigger.

The latest automated run passed **20 tests**, including Admin/Support role fences, course publication, manual grant, strict refund boundaries, request idempotency, a simulated service-only settlement, preservation of manual access, audit events and CSV formula neutralisation. The staging browser suite also passed its MFA/role boundaries, course authoring and publication privacy, refund review, synthetic settlement, block/logout, responsive theme and targeted accessibility checks. The synthetic order is not a Cashfree payment.

The staging browser suite in [verify-admin.mjs](../backend/scripts/verify-admin.mjs) creates disposable Admin/Support/Student identities and a temporary published course using the configured ready test video. It tests actual MFA and HTTP role boundaries, public listing, grants, a synthetic paid order, refund review, CSV, a simulated database settlement, and responsive/accessibility screens. It removes its own records. The synthetic order is **not a Cashfree payment**. Actual uploads of owner media, inbox delivery, DRM on physical devices and live refunds remain separate acceptance steps.

## Operator access and commands

The owner has not supplied a verified user UUID for permanent Admin provisioning. No real account has been promoted. Once the intended owner account is created and email-verified in staging, copy its UUID from Supabase Authentication → Users. A controlled CLI grants only that exact existing verified account Admin access, records an operator audit, and never creates a default password:

```powershell
npm run admin:bootstrap -- --user-id YOUR_VERIFIED_USER_UUID --apply
```

The owner then signs in at `/admin/login` and enrolls/verifies a TOTP authenticator. AAL1 cannot use the Admin APIs. The CLI refuses unverified, blocked or already-privileged accounts and refuses non-staging database targets. Do not paste PAN, passwords, service-role credentials or authenticator codes into chat.

To verify Phase 4 playback without Cashfree, the owner can create an honestly labelled staging course in **Admin → Courses**, add a module and protected lesson, select **Use configured test video**, verify the ready status/duration, and publish intentionally. In **Admin → Students**, find their own verified account and add an audited manual grant with a reason. The owner can then open `/learn` in a normal Chrome/Edge profile and test the player and watermark. A published course's title/curriculum is visible on the public staging pages; only the paid lesson video/notes remain private. This is a real Admin-controlled setup, not a permanent automatic demo enrollment.

From the repository root, verify with:

```powershell
npm run check
npm run db:verify
npm run build
npm run test:admin
npm run smoke
```

The browser suite needs Playwright Chromium or `PLAYWRIGHT_CHROMIUM_EXECUTABLE` and staging provider credentials; it is not included in ordinary CI. `npm run notifications:send -- --send` is deliberately an explicit operator command. It contacts Resend for real queued recipients, so run it only after an approved business sender and delivery monitoring are configured. The worker is not invoked by the test suite.

## Acceptance still open

1. Cashfree sandbox checkout, signed webhook consumption, order creation, actual refund requests and idempotent provider settlement are Phase 3 dependencies. Neither Admin approval nor a redirect moves money or grants access. Invoice generation/resend and reconciliation stay disabled until those flows pass.
2. Permanent owner Admin onboarding, real course details/media, verified instructor biography/portrait permission, author-approved policies, tax/billing identity, official community links and any genuine testimonials are owner-provided inputs. The Admin content editor has fields for these facts but seeds none of them.
3. Direct browser upload and processing status for an owner-selected video, normal-browser DRM playback and visible watermark, plus supported mobile browsers, need human acceptance. Automated isolated Chrome reported Widevine unavailable in Phase 4.
4. Notification retries need a verified sender, an operational schedule and actual inbox/delivery checks. Telegram member removal needs a named human process; a copied external invite cannot be revoked from this database alone.
5. The CSV export is capped at 1,000 filtered orders and clearly labels that limit. Large exports, reconciliation volume, monitoring, backup/restore and load capacity belong to Phase 6. Audit/notification retention needs an owner-approved schedule.
6. Phase 5 staging implementation is verified. The provider-dependent refund end-to-end gate remains open until Cashfree is approved and Phase 3 is delivered; real checkout remains disabled throughout.
