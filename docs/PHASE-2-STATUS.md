# Phase 2: accounts, roles and device access

Updated: 29 October 2026, IST. **Implementation delivered; provider acceptance incomplete.** Phase 2 remains IN PROGRESS until real email delivery and the Google consent/callback journey pass. Checkout remains disabled. No additional environment variables are required beyond the existing template.

## Latest provider recheck

29 October 2026: Google is enabled in Supabase and application PKCE initiation passed. One operator email was accepted and reported delivered by Resend. It uses the testing sender, so business-domain verification for general recipients remains open. Complete a real Google browser sign-in and delivered signup/reset/invitation journeys before full Phase 2 sign-off. Earlier provider failures in the original handover have been superseded by these results.

## Delivered

| Feature            | Implemented behavior                                                                                                                                                                                                                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email accounts     | Signup with name, email, password and optional phone; provider email verification required before admission. Generic signup/reset responses avoid disclosing whether an address exists.                                                                                                                                                                                     |
| Email links        | Supabase generates the actual verifier; the backend sends a separate random application link through Resend. Only its digest and an encrypted provider verifier are stored. Links expire after 30 minutes, are consumed atomically once, and require a button POST; scanners opening GET cannot consume them.                                                               |
| Password recovery  | A confirmed recovery/invitation link grants only a single-use ten-minute password operation. It does not admit a device or unlock private account data. Saving a new password revokes all application sessions. Ordinary password changes require the current password.                                                                                                     |
| Sessions           | Server-verified Supabase identity, HttpOnly/SameSite Lax cookies, Secure cookies on HTTPS, SSR refresh, no-store private responses, local and global logout. Browser-session cookies and a 12-hour admission without remember-me; up to 30 days with it. Browser session restoration can preserve session cookies, so the server expiry is the enforcement boundary.        |
| Two devices        | Atomic profile-row locking admits at most the configured limit (default two). A third session can view only its device-selection information, then revoke one owned device and continue. Concurrent login attempts cannot exceed the limit. Devices are login sessions/browser profiles, not hardware fingerprints.                                                         |
| Private data       | The application checks admitted, unexpired, unrevoked provider-backed sessions on protected operations. Database RLS independently checks admission for own profile, orders, enrollments and device reads. Direct REST calls from pending/revoked tokens cannot bypass it.                                                                                                  |
| Account controls   | Profile/name/optional-phone editing, current device indicator, device activity timestamps (updated at most every five minutes), individual revoke and sign out all. No client-supplied role changes.                                                                                                                                                                        |
| Staff              | Separate staff login; Admin/Support roles read from the database; actual Supabase TOTP enrollment and verification; AAL2 required for privileged endpoints. Only an admitted Admin at AAL2 can list, invite or remove Support. Existing student accounts are never silently promoted by an invite. Removal demotes Support and revokes sessions while preserving purchases. |
| Google             | PKCE initiation, server callback, validated internal return path and actual-provider readiness check. The UI disables Google honestly when provider settings are unavailable. Real consent acceptance is still pending.                                                                                                                                                     |
| Abuse controls     | Shared PostgreSQL counters for login, signup, reset, email-link use, password changes, MFA and staff operations. Account counters span IPs; IP counters use the trusted Vercel header in deployment and a shared local bucket in local preview. Cross-origin mutations and oversized/non-JSON bodies are rejected.                                                          |
| Public integration | Header switches to My account for admitted sessions; auth/private pages are noindex; privacy/terms now describe staging account processing. Premium responsive forms match the existing site.                                                                                                                                                                               |

Routes: `/login`, `/signup`, `/forgot-password`, `/auth/confirm`, `/reset-password`, `/auth/devices`, `/account`, `/admin/login`, `/admin`. Framework adapters remain in [app](../app), presentation in [frontend](../frontend) and security/handlers in [backend](../backend). There is still one package and one application deployment.

## Database evidence

Applied to the configured staging project with the existing checksum-ledger runner:

- [002 auth sessions](../backend/database/migrations/202610290002_auth_sessions.sql): admission, private email/recovery/rate tables, revocation, audited device replacement and admitted-session RLS.
- [003 auth hardening](../backend/database/migrations/202610290003_auth_hardening.sql): provider-backed device management and atomic recovery-grant consumption.

`npm run db:verify` passed: **three migration checksums, 15 RLS-protected tables, restricted private auth-table grants, nine server-only auth RPC grants, baseline triggers and defaults**. Already-applied migration files were not edited. No real owner account was promoted or password changed.

## Verification

| Check                                             | Evidence / result                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint, TypeScript and automated SQL/security tests | PASS; 15 tests, including real PostgreSQL-compatible migration/RLS behavior in disposable PGlite.                                                                                                                                                                                                          |
| Production build                                  | PASS; all public/auth/account/admin routes and Next proxy compile.                                                                                                                                                                                                                                         |
| Live staging auth suite                           | PASS; six disposable accounts exercised real password login, cookie policy, profile editing, escalation rejection, device selection, immediate revocation including direct REST, all-session logout, password change and simultaneous admission.                                                           |
| Email-token logic                                 | PASS with real Supabase-generated signup/recovery verifiers inserted into the private action store by the staging test. GET safety, expired/replayed links, recovery isolation and reset worked. **This does not prove inbox delivery.**                                                                   |
| Staff MFA and boundaries                          | PASS; actual provider TOTP enrollment/challenge using a disposable Admin, AAL1 denial, AAL2 access, Support denial, refusal to promote an existing student through invitations, and removal revocation.                                                                                                    |
| Login throttling                                  | PASS; the eleventh account attempt is rejected.                                                                                                                                                                                                                                                            |
| Responsive/accessibility                          | PASS; 48 auth/account/device combinations across 1440/390/360px and both themes, no overflow, runtime errors or WCAG A/AA Axe violations. A colour-only account link found during the audit was underlined and the suite passed again. Automated Axe does not replace manual assistive-technology testing. |
| Storefront regression and smoke                   | PASS; 48 existing storefront viewport/route/theme combinations, interactive controls, theme persistence, targeted accessibility, public/404 routes, sitemap, staging noindex and disabled checkout.                                                                                                        |
| Formatting and editor diagnostics                 | PASS; repository formatting check and editor diagnostics after implementation. Installed skill sources remain excluded and unmodified.                                                                                                                                                                     |
| Resend transport                                  | **PASS for operator testing:** the latest message was accepted and Resend reported delivered. The testing sender is configured, so general student recipients still require a verified business domain. The earlier HTTP 403 is resolved for the configured test recipient.                                |
| Google                                            | **Provider setup resolved:** Supabase reports enabled, the app enables Google and POST initiation returns 200 with Google provider and PKCE. Actual user consent, callback and same-email linking acceptance remain pending.                                                                               |

Test fixtures and their device/order/audit records were cleaned up. No secret values, passwords, tokens, MFA QR codes or personal recipient addresses are included in reports. Local screenshots/reports stay in the ignored review directory. Paid-course playback revocation is a Phase 4 test because no player exists yet.

Reproduce from the root with a current production preview running:

```powershell
npm run check
npm run db:verify
npm run test:auth
npm run test:auth:ui
npm run test:ui
npm run smoke
```

Browser scripts require Playwright Chromium or `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Auth scripts require the existing staging database/project credentials, create only disposable test accounts, and remove their own records. They intentionally call real staging identity APIs and are not automatic CI jobs. Avoid repeated whole-suite runs within a rate-limit window. `npm run test:email` separately sends exactly one email to the configured operator recipient and checks its delivery event; do not run it against arbitrary people.

## Remaining acceptance steps

1. **Email sender:** in Resend verify a sender domain you control and confirm the API key is authorised for it. Set `RESEND_FROM_EMAIL` to an address under that domain. The former HTTP 403 is resolved for the operator test using the testing sender. A business sender still needs verification and matching key permissions. A testing sender can be used only under Resend's recipient restrictions. Then run `npm run test:email`, confirm the inbox, and complete signup, reset and a Support invitation through delivered messages in the browser. Do not publish general student registration until this works.
2. **Google:** provider enablement and app PKCE initiation are now verified. Complete the browser acceptance with the configured Cloud client credentials. In Google Cloud allow the Supabase callback displayed by Supabase. In Supabase allow the exact application's `/auth/callback`; set the local flag only after setup. Use the same origin as `NEXT_PUBLIC_APP_URL` throughout the browser journey, since PKCE verifier cookies belong to that hostname. Verify new Google login, returning login, same verified email and a course return path.
3. **Owner administrator:** provision the first real administrator through the controlled operator procedure below, then enroll the owner's authenticator. Disposable test administrators have been deleted.

The application sends generated-token messages through Resend directly; Supabase custom SMTP is **not** required for these application routes. SMTP is a separate requirement only if using Supabase's own email-sending routes/dashboard features.

## Identity linking policy

Delegate same-email OAuth identity linking to Supabase's verified-identity mechanism. The application does not merge profiles, copy purchases or trust user-supplied provider/role metadata. Different email addresses remain separate accounts; no manual cross-email linking endpoint is exposed. Before enabling Google, verify the provider's email claims and test the same verified address against an existing account. Supabase documents removing unconfirmed identities during automatic linking to mitigate pre-account takeover. See [official identity-linking behavior](https://supabase.com/docs/guides/auth/auth-identity-linking).

## First administrator and operations

1. Once email delivery works, the owner creates and verifies their staging account through the application. An authorised operator checks the exact user UUID and confirmed address in Supabase Authentication. Do not select an account solely from its displayed name.
2. In the private Supabase SQL editor, update only that verified UUID in `public.profiles` to `role='admin'`, and record an operator audit entry. This is a controlled owner provisioning action; no unauthenticated bootstrap endpoint, default password or signup role field exists. Avoid bulk updates. No real owner role was changed during testing.
3. The owner signs in at `/admin/login`, enrolls a TOTP authenticator and verifies a current code. Until AAL2, staff endpoints return `MFA_REQUIRED`. Invite Support from this workspace after sender acceptance. Support must set a password, log in and enroll its own authenticator before privileged use.
4. Failed invitation delivery leaves an unconfirmed invited identity; the interface does not falsely report success. An Admin can remove its Support role. If a new invitation is needed, an operator must review that specific unconfirmed invitation/account before retrying; do not delete an established learner or bypass the existing-account guard. A resend workflow is not implemented.
5. Lost staff authenticators require a separately verified operator recovery procedure. Password recovery does not bypass the privileged MFA gate. Do not disable MFA as a shortcut. A staff account with an existing factor may require provider MFA before password updates; this edge case is not claimed tested.
6. Supabase service-role credentials remain backend-only. They derive the email-verifier encryption and limiter HMAC keys; rotating the key invalidates outstanding email links and resets effective limiter buckets. Generate fresh links after rotation. Do not expose this key to browser code.
7. The Phase 6 operations work must schedule expiry cleanup for rate counters and consumed/expired email/recovery rows, agree audit retention, monitor delivery failures and verify deployed HTTPS cookies, trusted client-IP behavior and callbacks. Current expiration is enforced at access time; old rows do not grant access. Do not delete audit history as routine cleanup.

Official references: [Supabase generated links](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [MFA challenge/verify](https://supabase.com/docs/reference/javascript/auth-mfa-challengeandverify), [Resend errors](https://resend.com/docs/api-reference/errors).

## Next implementation boundary

Phase 3 adds server-owned checkout, price/tax snapshots, coupons, sandbox Cashfree processing and receipts. Phase 4 adds purchased-course learning. Account creation alone grants neither a purchase nor protected video access. The overall site is not ready for live sales.
