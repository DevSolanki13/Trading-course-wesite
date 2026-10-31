# Trading course website

Next.js 16 / React 19 trading-course website using the existing Supabase/PostgreSQL, Radix and shared light/dark theme system. The purchase flow now includes an isolated zero-env local demo and a Razorpay provider selected by configuration. Existing Cashfree, account security, Admin and DRM integrations are retained. This implementation does not establish live merchant/content/tax/DRM acceptance.

## Run locally with zero environment setup

Requires Node **22.19.0 or newer** and npm. No gateway account, database account, SMTP account or `.env` file is needed:

```powershell
npm ci
npm run db:seed
npm run dev:demo
```

Open <http://127.0.0.1:3000>. If that port is already serving another app, use `npm run dev:demo -- --port 3001` instead. The demo runner uses a separate build directory and clears external-service credentials in its child process; it never edits your local environment file or contacts your Supabase project. With no existing environment configuration, `npm run dev` also chooses the local store automatically. `dev:demo` is the reliable choice when this checkout already contains real/staging configuration.

The local store is an embedded PostgreSQL-compatible PGlite database, using the same ten SQL migrations as Supabase. It lives in ignored `.local-data/demo-v1/`; passwords use bcrypt and opaque session tokens are stored only as hashes. No Prisma/SQLite replacement was introduced. The sample video is an explicitly labelled public placeholder; paid instructor media continues through the production DRM integration.

Test accounts (local development only):

| Role          | Email               | Password     |
| ------------- | ------------------- | ------------ |
| Student       | `demo@example.com`  | `1234567890` |
| Administrator | `admin@example.com` | `1234567890` |

The first seed creates three sample courses and no purchases. Re-running it preserves existing purchases/progress. Demo credentials must not exist in a live sales database. Demo administrator access is limited to the isolated learning dashboard; production staff role/MFA checks remain unchanged. The development login hint can fill the credentials and be dismissed. New local signups are test accounts and do not require real email verification; configured Supabase signup retains its existing verification policy.

## Test the complete journey

1. Open a sample course and choose **Buy now**. Sign in with the student account or create a new local account. The login redirects back to that course's checkout.
2. Confirm the summary and terms. The checkout shows **TEST MODE: no real money is charged**. Choose **Pay successfully**, **Simulate failure**, or **Cancel**.
3. A successful payment opens `/checkout/success?orderId=...`. Use **Start learning** or visit `/dashboard`.
4. Open a lesson, read the sample notes, play the placeholder video and choose **Mark as complete**. Return to the dashboard to see saved progress and continue learning.
5. Open `/dashboard/orders` and the private printable receipt. A failed/cancelled test never creates enrollment. Buying an owned course instead offers **Go to course**.
6. Without Resend configuration, development confirmation emails are logged once in the server console as **DEV EMAIL — not delivered**, including the receipt and course links. A mail error never rolls back paid access. Production queues delivery instead of logging personal email content.

The local sample video requires network access, but lesson notes/completion do not. Direct paid lesson requests without entitlement redirect to the course with **Purchase to unlock**; free previews remain public. No native-video fallback is offered for protected production lessons.

```powershell
npx playwright install chromium
npm run test:purchase
npm run check
npm run test:unit
npm run build
```

Purchase browser tests use a fresh local test store on port 3102; they never alter your development purchases or external services. The original release browser suite remains available as `npm run test:release`.

## Switch to Razorpay and prepare production

Stop the isolated demo runner and start the normal app with these protected settings:

```dotenv
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=your_test_or_live_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_independent_webhook_secret
ALLOW_MOCK_PAYMENTS=false
SEED_DEMO_USERS=false
LOCAL_DEMO=false
NEXT_PUBLIC_APP_URL=https://your-approved-domain.example
```

Use Razorpay **test keys first**. With the selector and both keys present, the provider factory uses Razorpay without code changes. Production with missing keys fails closed with **Payments temporarily unavailable** and a server warning. Explicit `ALLOW_MOCK_PAYMENTS=true` is for a dedicated test deployment only; it does not provision a production database or approve demo users. Mock APIs return 404 whenever the real provider is selected or production mock use is not permitted.

Configure the existing Supabase project URL/publishable key/service key and database operator URL from [.env.example](./.env.example). Resolve the recorded trust/ledger mismatch and review/apply migrations 009–011 on an authorised staging target before production schema changes. Local/demo users are never copied into Supabase. Production needs durable hosted PostgreSQL/Supabase; do not deploy the file-backed demo store across serverless replicas. `AUTH_SECRET` is not required by the existing Supabase/opaque-session implementation and does not replace Supabase credentials.

Register **`https://your-domain/api/webhooks/razorpay`** with the independent webhook secret and subscribe to captured/failed payment and refund events as appropriate. Checkout signatures and webhook HMACs are checked on the server; fulfillment additionally requires an API-confirmed captured payment matching the saved order, currency and amount. Authorized-but-uncaptured payments remain locked. See [Razorpay integration](https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps/) and [webhook validation](https://razorpay.com/docs/webhooks/validate-test/).

Before live sales:

- [ ] Authorised schema migration and verified production Supabase/auth configuration; no demo users or mock flags.
- [ ] Razorpay merchant approval, test purchase/webhook/replay verification, capture configuration and reconciliation/recovery acceptance.
- [ ] Real course content/video mappings and supported-device DRM acceptance.
- [ ] Approved prices, business details, tax treatment and policies. Live GST checkout remains gated pending the required invoice configuration; the printable acknowledgement is not a GST invoice.
- [ ] Verified Resend sender and actual confirmation delivery/retry acceptance; production scheduler/alerts configured.
- [ ] Correct domain/HTTPS, OAuth redirects, WAF, backup/restore and production smoke checks.

Earlier foundation/setup notes below describe the retained staging services; they are not prerequisites for running the isolated local demo.

## Requirements

- Node.js 22.19 or newer (tested with 22.19.0), npm and Git.
- An isolated Supabase staging project, Cashfree sandbox, VdoCipher test video, Resend verified sender and Google OAuth configuration for the external Phase 0 gates.
- Vercel staging project linkage before cloud migrations or the normal development workflow.

## Install and verify the local foundation

```powershell
npm ci
Copy-Item -LiteralPath .env.example -Destination .env.local
npm run env:check
npm run check
npm run format:check
npm run build
```

Copy the template only when the local file does not already exist. Fill values directly in the ignored local file or secure environment settings. Never paste secrets into commands, Markdown, screenshots or chat. Configuration checks print key names and status only. A missing-service exit code is expected until configuration is complete; it is not an application crash.

The public storefront and health route run without provider credentials. Service operations fail closed if required configuration is missing. The landing page uses self-hosted fonts and an obsidian/slate/electric-blue design; its hero image and video were removed at the owner's request. Original course artwork remains elsewhere. Brand, illustrative outlines/prices, instructor facts and policies remain provisional until owner-approved content is published; real checkout is disabled. See [Phase 1 status](./docs/PHASE-1-STATUS.md) and [Phase 2 status](./docs/PHASE-2-STATUS.md) for acceptance gaps and verification.

## Staging setup

Follow [the service setup guide](./docs/SETUP.md) and [Phase 3 acceptance steps](./docs/PHASE-3-STATUS.md). Nine migrations pass the disposable local tests; migration 009 has not been applied to shared staging. Trust/ledger and hosting access need restoration. Local builds perform no cloud migrations or account creation.

**Current acceptance (31 October):** see [Phase 6 status](./docs/PHASE-6-STATUS.md) and [the operational runbook](./docs/OPERATIONS-RUNBOOK.md). Fresh local checks pass; shared staging verification is blocked by database trust/ledger issues and the saved Vercel project is inaccessible to current credentials. The earlier migration statements above are historical, not fresh schema acceptance.

After setup:

```powershell
npm run dev
```

Open <http://localhost:3000>. The scripts bind to loopback, not the public network.

## Commands

| Command                         | Purpose                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run check`                 | ESLint, strict TypeScript, config/signature tests and disposable PostgreSQL migration/RLS tests |
| `npm run build`                 | Next.js production compilation                                                                  |
| `npm start`                     | Serve a production build on loopback                                                            |
| `npm run format:check`          | Verify formatting                                                                               |
| `npm run env:check`             | Names-only configuration/linkage readiness; nonzero while incomplete                            |
| `npm run providers:check`       | Read-only Supabase/schema and Resend-domain probes; no test order or email                      |
| `npm run providers:cashfree`    | Explicitly create one INR 1 sandbox order; never calls production                               |
| `npm run providers:video`       | Generate a backend OTP and ignored private playback HTML; may consume provider quota            |
| `npm run providers:email`       | Send one test email to the configured operator recipient; may consume provider quota            |
| `npm run db:migrate -- --apply` | Apply reviewed migrations transactionally to the configured staging database                    |
| `npm run db:verify`             | Read-only verification of all migration checksums, RLS tables and restricted auth grants        |
| `npm run test:auth`             | Live staging tests using disposable users, real identity/MFA and controlled fixture cleanup     |
| `npm run test:auth:ui`          | Auth/account/device responsive and Axe checks using one disposable staging account              |
| `npm run test:email`            | Send one operator test email; check provider delivery event without printing addresses          |

Provider probes distinguish configuration, API acceptance and actual end-to-end verification. A `PARTIAL` result intentionally returns nonzero: an accepted message, order or token does not prove inbox delivery, completed payment or browser playback. Do not put side-effecting provider probes in CI. Never upload the ignored artifacts directory; it can contain short-lived credentials or payment-session information.

After starting the local production build, `npm run smoke` verifies the public routes. `npm run test:ui` runs the responsive/interaction/Axe checks and saves local review screenshots. It requires a Playwright Chromium installation (`npx playwright install chromium`) or an explicit `PLAYWRIGHT_CHROMIUM_EXECUTABLE` path. This browser suite operates on the local preview only; it does not create purchases or contact external providers.

## Layout

- [Frontend](./frontend): pages, layouts and styles for the presentation layer.
- [Backend](./backend): HTTP handlers, configuration, security and database access.
- [Database](./backend/database): Supabase clients and nine versioned [migrations](./backend/database/migrations); verify the actual target/ledger before applying.
- [Next.js routes](./app): thin framework entry files connecting UI pages and backend handlers to their original URLs.
- [Operator scripts](./backend/scripts): readiness, provider probes and controlled migration runner.
- [Tests](./tests): focused configuration, webhook authenticity and database access tests.
- [Phase 0 report](./docs/PHASE-0-STATUS.md): verification evidence and remaining gates.

There is one [package manifest](./package.json), one dependency lockfile, one build and one deployment. Run every npm command from the repository root. See [architecture](./docs/ARCHITECTURE.md) for the folder tree and dependency rules.

## Boundaries still to implement

Live checkout remains disabled. Demo and Cashfree sandbox modes are explicitly opt-in. Cashfree now has an API-confirmed consumer/reconciliation, atomic enrollment/billing/email persistence and full-refund dispatch/recovery. Private PDF/HTML records and credit notes use immutable snapshots. Actual sandbox acceptance, approved statutory invoice/tax inputs, coupon redemption, production enablement and delivery/DRM acceptance remain open. See [Phase 3](./docs/PHASE-3-STATUS.md) for supported states and limitations.

## Repeatable Phase 6 verification

```powershell
npx playwright install chromium
npm run verify:release
npm run test:performance
# Read-only checks against the verified staging target, after configuring its trusted CA:
npm run db:verify
npm run ops:check
```

The release browser suite uses dedicated port 3100 and synthetic configuration; performance uses port 3101. Both require a production build and refuse to reuse an existing server. Reports live under ignored `artifacts/phase-6/`. Tests do not prove real Cashfree, physical-device DRM or hosted recovery. `DATABASE_CA_CERT_PATH` accepts the trusted CA downloaded from the exact Supabase project's Database Settings; do not disable TLS checks. Retired ad-hoc mutation scripts now refuse changes, and old verification shortcuts delegate to the supported read-only verifier.

## Student learning area

Open `/learn` after signing in, or follow My learning from `/account`. Published course classrooms live at `/learn/[slug]`. The library reflects actual database enrollments; illustrative storefront outlines are not automatically published courses or purchased access. No demo enrollment was added to the owner's real account.

`npm run test:learning` exercises disposable staging courses/accounts and real provider token generation. Its SDK-contract simulation is separate from actual DRM testing. The command reports a partial, nonzero result when the browser cannot confirm protected playback; this environment's isolated Chrome reported Widevine unavailable. See [the learning runbook](./docs/PHASE-4-STATUS.md) for content contracts, manual browser acceptance and remaining Phase 3 dependencies.

Use `/login`, `/signup`, `/account` and `/admin/login` for the new flows. Test scripts requiring staging credentials are operator tools, not automatic CI jobs. They do not use an existing person's account. Read [the auth runbook](./docs/PHASE-2-STATUS.md) before running them or provisioning the first administrator.

## Phase 5 operator workspace

After verifying the owner's staging account, an authorised operator can run `npm run admin:bootstrap -- --user-id YOUR_VERIFIED_USER_UUID --apply`. The owner then signs in at `/admin/login`, enrolls/verifies their authenticator and opens `/admin`. Course publishing uses real approved metadata, ready VdoCipher video and explicit Admin action. Support can inspect students/orders/refunds and grant access but cannot change prices, content, settings or staff. See [the Phase 5 report](./docs/PHASE-5-STATUS.md) before publishing or testing with real owner content.

`npm run test:admin` uses disposable staging identities and a temporary course/order. Explicit notification commands send real queued messages and were not invoked against students. `npm run operations:run` is a dry run; `-- --run` explicitly calls the protected staging worker after configuration. Notification delivery has a separate opt-in. Hosted scheduling/alerts, actual merchant/email acceptance and production enablement are still pending.

### Course access periods

Courses have a finite access period, configured in the administrator course editor in days or calendar months (default: one month). Video duration and access duration are separate. Successful payment starts access; checkout snapshots its period and a later course edit does not change an existing enrollment. The dashboard, confirmation and receipt show the end date in IST. After expiry, paid lessons/progress APIs deny access and the student can buy a fresh period while retaining learning progress. Free previews and private receipts remain available. There are no automatic recurring charges.

[Migration 011](./backend/database/migrations/202610310011_course_access_expiry.sql) is additive and is applied automatically only by the isolated local demo on initialization. Shared databases require reviewed deployment after outstanding migrations. It gives existing courses a one-month default and backfills enrollment expiry from the original payment/grant time; older enrollments may expire immediately. Review legacy-customer treatment and course periods before applying it to shared staging/production. No shared migration was run for this change.
