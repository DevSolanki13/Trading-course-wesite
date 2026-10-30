# Trading course website

Next.js + TypeScript trading-course storefront for [the source brief](./course-website-requirements.md). This is a full-stack monolith with one root package and layered frontend, backend and database structure. The public storefront, account/device security and student classroom are implemented in staging. Phase 5 Admin/course/refund-review implementation is in progress. Cashfree/Phase 3 is deferred; supported-browser DRM, real course/content approval and remaining launch gates are open. Track evidence in [the plan](./IMPLEMENTATION-PLAN.md), [Phase 4 report](./docs/PHASE-4-STATUS.md) and [Phase 5 report](./docs/PHASE-5-STATUS.md).

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

Follow [the service setup guide](./docs/SETUP.md) in order. Vercel staging linkage and all five staging database migrations are verified. Production builds can be checked locally independently; they perform no account creation or cloud migrations.

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
- [Database](./backend/database): Supabase clients and the five applied [staging migrations](./backend/database/migrations).
- [Next.js routes](./app): thin framework entry files connecting UI pages and backend handlers to their original URLs.
- [Operator scripts](./backend/scripts): readiness, provider probes and controlled migration runner.
- [Tests](./tests): focused configuration, webhook authenticity and database access tests.
- [Phase 0 report](./docs/PHASE-0-STATUS.md): verification evidence and remaining gates.

There is one [package manifest](./package.json), one dependency lockfile, one build and one deployment. Run every npm command from the repository root. See [architecture](./docs/ARCHITECTURE.md) for the folder tree and dependency rules.

## Boundaries still to implement

There is no buy-now endpoint. Learning APIs now issue protected playback tokens only after entitlement checks or published-preview permission. Cashfree events are signature-checked and stored in a durable inbox; no consumer processes them or grants enrollment yet. Accounts enforce device admission, application revocation, durable auth limits and staff MFA. Learning adds server-owned progress and watched ranges. Payment processing, receipts, refund workflows and content-management UI remain later work.

## Student learning area

Open `/learn` after signing in, or follow My learning from `/account`. Published course classrooms live at `/learn/[slug]`. The library reflects actual database enrollments; illustrative storefront outlines are not automatically published courses or purchased access. No demo enrollment was added to the owner's real account.

`npm run test:learning` exercises disposable staging courses/accounts and real provider token generation. Its SDK-contract simulation is separate from actual DRM testing. The command reports a partial, nonzero result when the browser cannot confirm protected playback; this environment's isolated Chrome reported Widevine unavailable. See [the learning runbook](./docs/PHASE-4-STATUS.md) for content contracts, manual browser acceptance and remaining Phase 3 dependencies.

Use `/login`, `/signup`, `/account` and `/admin/login` for the new flows. Test scripts requiring staging credentials are operator tools, not automatic CI jobs. They do not use an existing person's account. Read [the auth runbook](./docs/PHASE-2-STATUS.md) before running them or provisioning the first administrator.

## Phase 5 operator workspace

After verifying the owner's staging account, an authorised operator can run `npm run admin:bootstrap -- --user-id YOUR_VERIFIED_USER_UUID --apply`. The owner then signs in at `/admin/login`, enrolls/verifies their authenticator and opens `/admin`. Course publishing uses real approved metadata, ready VdoCipher video and explicit Admin action. Support can inspect students/orders/refunds and grant access but cannot change prices, content, settings or staff. See [the Phase 5 report](./docs/PHASE-5-STATUS.md) before publishing or testing with real owner content.

`npm run test:admin` uses disposable staging identities and a temporary course/order. `npm run notifications:send -- --send` is a separate operator action that sends real queued refund-status emails; it has not been scheduled or invoked against students during implementation. Final inbox delivery, provider refunds, receipts and reconciliation depend on external setup and Phase 3.
