# Phase 0 execution status

**Updated:** 29 October 2026 (IST)  
**Status:** Local foundation complete; external acceptance checks awaiting configuration.  
**Full Phase 0 exit gate:** NOT PASSED.

## Latest staging database check

**PASS:** the updated Session pooler connection matches the configured Supabase project. Database connectivity and the Supabase auth schema were verified. The initial direct-connection IPv6 networking issue is resolved through the pooler.

`npm run db:migrate -- --apply` successfully committed `202610290001_initial_foundation.sql` to staging. `npm run db:verify` then passed: migration ledger/checksum, all 12 RLS-protected tables, ownership/public-read policies, restricted table grants, both triggers and default settings. Verification used read-only queries. No customer/test purchase data was inserted; the migration created the schema and its default settings row.

The migration/verification scripts check that the database URL belongs to the same configured Supabase project and report safe error codes without printing credentials. Full verification checks the migration ledger/checksum, 12 RLS-protected tables, policies, restricted grants, triggers and default settings.

## Folder structure update

The requested single-package layered monolith is implemented. [Frontend](../frontend) contains pages, layouts and styles. [Backend](../backend) contains handlers, configuration, security and [database access/migrations](../backend/database). [Next.js route entries](../app) are thin adapters. The root package, lockfile, commands, environment location and deployment remain unified.

The initial migration was moved without changing its bytes or checksum. Imports, TypeScript paths, migration tooling, tests and documentation use the new paths. ESLint restricts cross-layer imports. After this reorganisation, lint, type checking, all 10 tests and the production build passed. See [architecture](./ARCHITECTURE.md) for the folder tree and responsibilities. External Phase 0 service gates remain unchanged.

The folder layout is further simplified: framework entries now live in root [app](../app), and utility commands live in [backend/scripts](../backend/scripts). Package commands, TypeScript aliases and documentation have been updated. One root package and deployment remain in use. The production build, lint, typecheck, all 10 tests and formatting passed after this move. The relocated environment-check command correctly reports the existing missing service configuration.

## Implemented and verified

- Git repository initialised on `main`; no commit or remote push made.
- Next.js App Router/React/strict TypeScript foundation with Tailwind, pinned npm dependencies and lockfile.
- Formatter, zero-warning ESLint, type checking, targeted tests and VS Code build/preview tasks.
- CI workflow prepared for checks and production build; not run on GitHub because no remote is connected.
- Ignored local environment file prepared, tracked blank template, server-only helpers and names-only readiness checks.
- Initial migration tested in disposable PostgreSQL, then applied to remote Supabase staging and verified successfully.
- Default-deny client writes; public published curriculum separated from private video assets; ownership read policies; paid-order immutability and inbox uniqueness tested. Signup metadata cannot assign an Admin role.
- Health endpoint and Cashfree raw-body HMAC verification with bounded request size and durable inbox writes when Supabase is available. Unconfigured storage/credentials fail closed. No event consumer or course unlock is implemented yet.
- Provider scripts prepared for read-only checks, one synthetic sandbox order, backend DRM token/playback artifact and an operator test email. No test order, token or email has been created without credentials.
- Dedicated [Vercel staging project](https://vercel.com/devs-projects-402f5056/trading-course-website-staging) created and linked locally. Only nonsecret sandbox/staging defaults configured for development/preview. No deployment, database integration or paid subscription created.

## Evidence

| Check                              | Actual result                                                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                     | PASS, zero warnings                                                                                                                                   |
| `npm run typecheck`                | PASS                                                                                                                                                  |
| `npm test`                         | PASS, 10 tests, zero failures                                                                                                                         |
| `npm run format:check`             | PASS                                                                                                                                                  |
| `npm run build`                    | PASS; root, health and Cashfree webhook routes compiled                                                                                               |
| Disposable PostgreSQL test         | PASS; migration syntax, realistic default grants, role isolation, private assets, paid totals, audit mutation restrictions and duplicate inbox events |
| Browser at `http://localhost:3000` | Foundation screen rendered with title, explanatory text and health link                                                                               |
| `npm run smoke`                    | PASS; home 200, health 200, unsigned/unconfigured webhook 503, checkout disabled                                                                      |
| Security headers                   | `nosniff` and frame denial returned on root; no-store returned on health                                                                              |
| `npm run env:check`                | EXPECTED INCOMPLETE; missing service key names reported, Vercel linkage present                                                                       |
| `npm run providers:check`          | BLOCKED for Supabase, Cashfree, video and email because required values are absent; no provider API calls made                                        |
| Git ignore checks                  | Local env, Vercel metadata and provider artifacts ignored                                                                                             |
| Dependency audit during install    | Zero reported vulnerabilities at installation time; not a guarantee of future security                                                                |

## Versions actually installed

| Tool/library                   | Version                                                                   |
| ------------------------------ | ------------------------------------------------------------------------- |
| Node.js                        | 22.19.0                                                                   |
| npm                            | 11.16.0                                                                   |
| Next.js / eslint-config-next   | 16.4.3                                                                    |
| React / React DOM              | 19.3.1                                                                    |
| TypeScript                     | 6.0.3                                                                     |
| Tailwind / PostCSS integration | 4.3.3                                                                     |
| Supabase JS                    | 2.118.0                                                                   |
| Supabase SSR                   | 0.12.7                                                                    |
| ESLint                         | 9.39.5                                                                    |
| Prettier                       | 3.9.10                                                                    |
| PGlite test engine             | 0.5.13                                                                    |
| PostgreSQL client (`pg`)       | 8.23.1                                                                    |
| Cashfree API target            | 2026-01-01, sandbox only; actual merchant compatibility not yet exercised |

The package lock is authoritative. ESLint 9 emitted an upstream end-of-support notice at installation; keep the compatible Next.js lint configuration during this foundation phase and evaluate the supported lint-major upgrade before launch. No dependency audit vulnerabilities were reported.

## Remaining Phase 0 gates

| Gate                                              | Current blocker                                             | Needed from                         | Next action                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| Staging Supabase database/auth and real migration | DONE: staging migration committed and verified              | Owner/developer with account access | No database action pending for Phase 0                                                |
| Cashfree sandbox order and reachable webhook      | No merchant sandbox credentials or deployed HTTPS endpoint  | Owner + developer                   | Configure staging credentials, deploy, create sandbox order and record event delivery |
| DRM playback on target devices                    | No video API secret, processed video ID or browser evidence | Instructor + developer              | Upload/process authorised lesson, issue OTP and verify real device playback/watermark |
| Resend sender/delivery                            | No API key, sender or operator recipient                    | Owner + developer                   | Verify DNS, configure SMTP/API, send and confirm test email                           |
| Google configuration                              | Supabase/Google provider details unconfigured               | Owner + developer                   | Configure both redirect boundaries; actual PKCE app flow follows in Phase 2           |
| Content/budget readiness                          | Instructor/course/business details and budget unconfirmed   | Business owner                      | Update plan input checklist; document verified service quotas and launch costs        |

Enter secrets directly into [the ignored local environment file](../.env.local) or protected Vercel/Supabase settings. The [tracked template](../.env.example) lists required names. Do not paste secrets into chat or the tracker.

## Local review

The production foundation is served on loopback at <http://localhost:3000> while the VS Code preview task is running. It is a setup screen only. Review [the README](../README.md) for commands and [service setup](./SETUP.md) for external steps.

Normal development and real database migrations remain gated by staging environment verification, per the [bootstrap skill](../../../.codex/plugins/cache/openai-curated-remote/vercel/0.54.1/skills/bootstrap/SKILL.md): “Do not run `db:push`, `db:migrate`, `db:seed`, or `dev` until Vercel linking is complete and env keys are verified.” Vercel linkage is now complete; missing environment values remain the substantive blocker. The local production-build smoke check requires no external credentials and makes no cloud changes.

## Next session

1. Configure missing service values using the setup guide.
2. Re-run failed readiness checks, then the relevant explicit provider probe.
3. Staging migration is complete; apply only new reviewed migrations when later features require them.
4. Record provider evidence and actual playback/delivery results; keep unverified gates open.
5. Mark Phase 0 DONE only when its exit gate is satisfied. Continue Phase 1 independently where it does not depend on unavailable services.
