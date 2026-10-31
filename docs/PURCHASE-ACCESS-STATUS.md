# Zero-env course purchase and access

Updated 31 October 2026. The requested local purchase/access flow is implemented and verified. Real Razorpay credentials, merchant acceptance and shared deployment/schema setup remain external launch steps. See [the quickstart](../README.md#run-locally-with-zero-environment-setup), [environment template](../.env.example) and [important-work tracker](../IMPwork.md).

## Setup and behavior

```powershell
npm ci
npm run db:seed
npm run dev:demo -- --port 3001
```

No `.env` or service account is needed. Open <http://127.0.0.1:3001>. The student is `demo@example.com / 1234567890`; the isolated demo administrator is `admin@example.com / 1234567890`. First-time seeds start both users without purchases, hash passwords with bcrypt, and preserve existing progress/purchases on subsequent runs. Run one local server per data folder and stop it before manually reseeding. Development-only hints can fill credentials and be dismissed.

`dev:demo` clears external credentials in its child process, uses a separate build directory, and never edits the user's environment file. The demo database stays under ignored `.local-data/demo-v1/`. It uses PGlite with the existing PostgreSQL migrations, rather than replacing Supabase with a different ORM/schema. Normal `npm run dev` also chooses local storage when no database/auth configuration exists. The isolated runner deliberately ignores real gateway keys; use normal app startup to test configuration-driven Razorpay selection.

The project uses Next.js 16.4.3, React 19, Supabase/PostgreSQL, Radix and shared light/dark CSS tokens; no existing shadcn installation was found. New surfaces preserve that system. Sonner provides themed feedback. Public placeholder video is labelled as local demo content and has a caption track. Production lesson routes continue to use the existing entitlement/device-checked DRM player, with no native-video fallback for paid instructor assets.

## Delivered flow

| Step          | Verified behavior                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Discover      | Published sample course, visible price, Buy now; owned courses become Go to course                                                              |
| Authenticate  | Login/signup returns to the same checkout; password hashing, private sessions, rate limits and client-role denial                               |
| Checkout      | Server reads prices/tax from PostgreSQL; clients cannot submit an amount; clear TEST MODE banner                                                |
| Mock result   | Approximately 1.5 seconds of processing; paid/failed/cancelled records; only confirmed success creates access                                   |
| Confirmation  | Private saved order, Start learning and printable receipt; pending confirmation can be checked again without another charge                     |
| Dashboard     | My courses, progress, continue learning, purchase history, empty/loading/error states and sign-out                                              |
| Classroom     | Module/lesson sidebar, preview exception, protected paid content, notes/video, previous/next, completion and persisted progress                 |
| Mail          | Receipt/course links logged in development when sending is unavailable; real sender/outbox integration; mail failure never reverses paid access |
| Real provider | Razorpay order/captured-payment API contracts, checkout/webhook HMAC, normalized status and duplicate-safe settlement                           |

The existing order/payment/enrollment/progress tables are reused. Migration 010 adds a canonical `purchase_access` primary key on `(user_id, course_id)` while retaining the existing enrollment ledger and historical/manual grants. It also adds private sample lesson content, durable event deduplication, provider metadata, order-creation claims and completion timestamps. No previous purchase history is deleted to impose a new unique constraint.

Razorpay creation retries query the stable receipt before creating an order. Ambiguous creation reservations wait two minutes before recovery; they do not silently create another charge. Signature verification alone does not grant access: canonical payment must be captured and match the saved order, amount and INR currency. Full refunds revoke only the corresponding purchase. Partial-refund/dispute business workflows still need separate acceptance if used.

## Verification evidence

- `npm run check`: lint, strict TypeScript and **39 Node tests** pass, including all ten migrations, money/ownership/rollback/unique-access constraints, factory production safety, signature/capture verification, receipt recovery and refunds.
- `npm run test:unit`: **10 React tests** pass.
- `npm run test:purchase`: **4 end-to-end tests** pass against a real isolated local application/database. They cover login return, successful/duplicate/failed/cancelled mock payments, receipt, persisted completion/dashboard, new signup, role injection, tampered amount, cross-origin rejection and unauthorized paid lesson access.
- The same purchase suite checks checkout/dashboard/player at 1280 and 390 pixels in dark/light themes: **12 layout combinations and 12 Axe audits**, with screenshots. Desktop dark player and mobile light checkout were inspected.
- `npm run test:release`: **32 existing production-browser checks** pass, including the production missing-key behavior and hidden mock endpoints.
- Production build passes. Local seeding succeeds and does not touch Supabase. npm reported zero known advisories when the added dependencies were installed.

This is not real merchant/bank, email inbox or physical-device production DRM acceptance. The earlier Lighthouse report was not remeasured for this feature. Local browser traces contain disposable demo sessions and stay ignored; CI uploads screenshots, not authenticated traces or local databases.

## Production setup still required

- [ ] Configure the existing Supabase auth/database services and approved app origin. Resolve the recorded staging trust/ledger issue and authorise migrations 009–010 before shared/production schema changes.
- [ ] Use `PAYMENT_PROVIDER=razorpay` plus valid `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`; test keys first. No provider code change is needed. Set `RAZORPAY_WEBHOOK_SECRET` independently and register `/api/webhooks/razorpay`.
- [ ] Verify capture, callback, webhook retries/replays, browser-close recovery and refund behavior with the actual merchant account before live keys. Razorpay approval is still pending.
- [ ] Keep `ALLOW_MOCK_PAYMENTS=false`, `SEED_DEMO_USERS=false` and `LOCAL_DEMO=false`; do not copy local demo users/data into production. Production with missing gateway keys logs a warning and refuses checkout.
- [ ] Supply real course content, DRM mappings, business/tax/policy approval and verified sender delivery. The printable acknowledgement is not a statutory GST invoice; approved GST checkout remains gated.
- [ ] Complete hosting/domain/HTTPS, staff/OAuth settings, WAF/alerts, delivery/reconciliation scheduling and backup/restore acceptance. File-backed local data is for one local process, not serverless replicas.

`AUTH_SECRET` is documented for compatibility with the requested template, but the retained Supabase auth and local opaque-session implementation do not require or consume it as a signing key. The optional certificate was not implemented. Demo administrator accounts do not bypass the production Admin MFA/role checks.

Changes were recorded in separate provider, database/auth, UI and documentation commits on `feat/zero-env-purchase-access`. No push, shared migration, real charge/refund, student email or deployment was performed.

## Complete file inventory

Files added or changed for this request, relative to the preceding verified baseline:

| Change  | File                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Changed | [.env.example](../.env.example)                                                                                                 |
| Changed | [.github/workflows/check.yml](../.github/workflows/check.yml)                                                                   |
| Changed | [.gitignore](../.gitignore)                                                                                                     |
| Changed | [.prettierignore](../.prettierignore)                                                                                           |
| Changed | [.vscode/tasks.json](../.vscode/tasks.json)                                                                                     |
| Changed | [IMPwork.md](../IMPwork.md)                                                                                                     |
| Changed | [README.md](../README.md)                                                                                                       |
| Changed | [app/account/page.tsx](../app/account/page.tsx)                                                                                 |
| Changed | [app/admin/page.tsx](../app/admin/page.tsx)                                                                                     |
| Added   | [app/api/payments/mock/[...action]/route.ts](../app/api/payments/mock/[...action]/route.ts)                                     |
| Added   | [app/api/purchase/[...action]/route.ts](../app/api/purchase/[...action]/route.ts)                                               |
| Added   | [app/api/webhooks/razorpay/route.ts](../app/api/webhooks/razorpay/route.ts)                                                     |
| Changed | [app/checkout/[slug]/page.tsx](../app/checkout/[slug]/page.tsx)                                                                 |
| Added   | [app/checkout/success/page.tsx](../app/checkout/success/page.tsx)                                                               |
| Changed | [app/courses/[slug]/page.tsx](../app/courses/[slug]/page.tsx)                                                                   |
| Added   | [app/dashboard/loading.tsx](../app/dashboard/loading.tsx)                                                                       |
| Added   | [app/dashboard/orders/[orderId]/receipt/page.tsx](../app/dashboard/orders/[orderId]/receipt/page.tsx)                           |
| Added   | [app/dashboard/orders/page.tsx](../app/dashboard/orders/page.tsx)                                                               |
| Added   | [app/dashboard/page.tsx](../app/dashboard/page.tsx)                                                                             |
| Added   | [app/learn/[slug]/[lessonId]/page.tsx](../app/learn/[slug]/[lessonId]/page.tsx)                                                 |
| Changed | [app/learn/[slug]/page.tsx](../app/learn/[slug]/page.tsx)                                                                       |
| Changed | [app/learn/page.tsx](../app/learn/page.tsx)                                                                                     |
| Changed | [app/login/page.tsx](../app/login/page.tsx)                                                                                     |
| Changed | [app/signup/page.tsx](../app/signup/page.tsx)                                                                                   |
| Added   | [backend/database/migrations/202610310010_purchase_access.sql](../backend/database/migrations/202610310010_purchase_access.sql) |
| Changed | [backend/handlers/auth.ts](../backend/handlers/auth.ts)                                                                         |
| Changed | [backend/handlers/learning.ts](../backend/handlers/learning.ts)                                                                 |
| Added   | [backend/handlers/purchase.ts](../backend/handlers/purchase.ts)                                                                 |
| Added   | [backend/local/auth.ts](../backend/local/auth.ts)                                                                               |
| Added   | [backend/local/database.ts](../backend/local/database.ts)                                                                       |
| Added   | [backend/local/http.ts](../backend/local/http.ts)                                                                               |
| Added   | [backend/local/seed.ts](../backend/local/seed.ts)                                                                               |
| Changed | [backend/payments/cashfree.ts](../backend/payments/cashfree.ts)                                                                 |
| Changed | [backend/payments/demo.ts](../backend/payments/demo.ts)                                                                         |
| Added   | [backend/payments/providers.ts](../backend/payments/providers.ts)                                                               |
| Changed | [backend/payments/types.ts](../backend/payments/types.ts)                                                                       |
| Changed | [backend/public/catalogue.ts](../backend/public/catalogue.ts)                                                                   |
| Added   | [backend/purchase/mail.ts](../backend/purchase/mail.ts)                                                                         |
| Added   | [backend/purchase/mode.ts](../backend/purchase/mode.ts)                                                                         |
| Added   | [backend/purchase/pages.ts](../backend/purchase/pages.ts)                                                                       |
| Added   | [backend/purchase/repository.ts](../backend/purchase/repository.ts)                                                             |
| Added   | [backend/purchase/service.ts](../backend/purchase/service.ts)                                                                   |
| Added   | [backend/purchase/session.ts](../backend/purchase/session.ts)                                                                   |
| Added   | [backend/scripts/local-preview.mjs](../backend/scripts/local-preview.mjs)                                                       |
| Changed | [backend/scripts/release-environment.ts](../backend/scripts/release-environment.ts)                                             |
| Added   | [backend/scripts/seed-local.mjs](../backend/scripts/seed-local.mjs)                                                             |
| Changed | [backend/scripts/verify-database.mjs](../backend/scripts/verify-database.mjs)                                                   |
| Changed | [backend/security/content-policy.ts](../backend/security/content-policy.ts)                                                     |
| Changed | [eslint.config.mjs](../eslint.config.mjs)                                                                                       |
| Changed | [frontend/components/auth-form.tsx](../frontend/components/auth-form.tsx)                                                       |
| Changed | [frontend/components/course-access-action.tsx](../frontend/components/course-access-action.tsx)                                 |
| Added   | [frontend/components/print-receipt.tsx](../frontend/components/print-receipt.tsx)                                               |
| Added   | [frontend/components/purchase-checkout.tsx](../frontend/components/purchase-checkout.tsx)                                       |
| Added   | [frontend/components/purchase-confirmation.tsx](../frontend/components/purchase-confirmation.tsx)                               |
| Added   | [frontend/components/purchase-dashboard.tsx](../frontend/components/purchase-dashboard.tsx)                                     |
| Added   | [frontend/components/purchase-player.tsx](../frontend/components/purchase-player.tsx)                                           |
| Added   | [frontend/components/purchase-toaster.tsx](../frontend/components/purchase-toaster.tsx)                                         |
| Changed | [frontend/components/site-header.tsx](../frontend/components/site-header.tsx)                                                   |
| Changed | [frontend/content/courses.ts](../frontend/content/courses.ts)                                                                   |
| Changed | [frontend/layouts/root-layout.tsx](../frontend/layouts/root-layout.tsx)                                                         |
| Added   | [frontend/lib/use-hydrated.ts](../frontend/lib/use-hydrated.ts)                                                                 |
| Changed | [frontend/pages/course-detail-page.tsx](../frontend/pages/course-detail-page.tsx)                                               |
| Added   | [frontend/styles/purchase.css](../frontend/styles/purchase.css)                                                                 |
| Changed | [next-env.d.ts](../next-env.d.ts)                                                                                               |
| Changed | [next.config.ts](../next.config.ts)                                                                                             |
| Changed | [package-lock.json](../package-lock.json)                                                                                       |
| Changed | [package.json](../package.json)                                                                                                 |
| Added   | [playwright.purchase.config.ts](../playwright.purchase.config.ts)                                                               |
| Changed | [proxy.ts](../proxy.ts)                                                                                                         |
| Added   | [public/demo-captions.vtt](../public/demo-captions.vtt)                                                                         |
| Added   | [shared/purchase.ts](../shared/purchase.ts)                                                                                     |
| Changed | [tests/admin-database.test.ts](../tests/admin-database.test.ts)                                                                 |
| Changed | [tests/auth-database.test.ts](../tests/auth-database.test.ts)                                                                   |
| Changed | [tests/learning.test.ts](../tests/learning.test.ts)                                                                             |
| Added   | [tests/payment-providers.test.ts](../tests/payment-providers.test.ts)                                                           |
| Changed | [tests/payment-security.test.ts](../tests/payment-security.test.ts)                                                             |
| Added   | [tests/purchase-access.test.ts](../tests/purchase-access.test.ts)                                                               |
| Added   | [tests/purchase-browser/flow.spec.ts](../tests/purchase-browser/flow.spec.ts)                                                   |
| Changed | [tests/release/security.spec.ts](../tests/release/security.spec.ts)                                                             |
| Changed | [tests/release/storefront.spec.ts](../tests/release/storefront.spec.ts)                                                         |
| Changed | [tsconfig.json](../tsconfig.json)                                                                                               |
| Added   | [docs/PURCHASE-ACCESS-STATUS.md](./PURCHASE-ACCESS-STATUS.md)                                                                   |
