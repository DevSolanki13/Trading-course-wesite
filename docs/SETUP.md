# Phase 0 service setup

Use a staging project and synthetic test data. Work through [the plan's Phase 0 checklist](../IMPLEMENTATION-PLAN.md#phase-0-confirm-inputs-and-prove-integrations). The current application intentionally cannot accept live payments.

## 1. Link the intended Vercel project

The connected account was inspected and a dedicated `trading-course-website-staging` project was created. This workspace is linked through ignored local metadata. The separate Supabase staging database is connected and migrations 001–003 are applied; a hosted application deployment is not yet verified. Existing unrelated projects were not reused.

On a fresh checkout, select that staging project in the appropriate team. Do not enable billable integrations without confirming their costs. With a locally authenticated Vercel CLI, link this folder to the exact project:

```powershell
npx vercel link
npx vercel env pull .env.local --environment=development
```

Pulling replaces the local file. Preserve any manually configured development values securely before pulling. Keep production credentials separate from preview/development. Do not mark the project linked until the local metadata identifies the intended project.

## 2. Supabase staging database/auth

Create/select a dedicated Supabase project and record its project reference in private configuration. Populate:

- `NEXT_PUBLIC_SUPABASE_URL`: HTTPS project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key; legacy anon key is also accepted by the client.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only service-role key.
- `DATABASE_URL`: direct or session-pooler PostgreSQL connection URI with TLS verification; password URL-encoded where needed. Never put it under a public prefix.
- `PROJECT_STAGE=staging`.

Review [the baseline migration](../backend/database/migrations/202610290001_initial_foundation.sql) before applying. Use the custom runner as the single migration ledger for this initial setup:

```powershell
npm run db:migrate -- --apply
```

If the direct address is IPv6-only and the development network cannot reach IPv6, use the exact **Connect → Session pooler** URL, on port **5432**, for `DATABASE_URL`. Populate the database password (percent-encoding reserved characters). Do not guess the pooler host or use the transaction pooler on port 6543 for this migration workflow. See [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

Verify before and after applying:

```powershell
npm run db:verify -- --connection-only
npm run db:migrate -- --apply
npm run db:verify
```

The verifier uses read-only SQL and reports schema/policy/checksum results without displaying database credentials. Stop if the connection-only check fails.

The runner checks staging configuration and project linkage, takes a transaction lock, applies pending files and records checksums in a private ledger. It refuses modified already-applied migrations. Use a new migration for future changes. Do not also apply these files with a different migration tool without reconciling its ledger. Do not use transaction-pooler connections for this session-sensitive runner.

The disposable PostgreSQL test in `npm test` is useful evidence about SQL constraints and RLS; it does not prove Supabase provisioning, remote auth or deployed permissions. Keep admin role promotion a controlled server/operator action. Never assign roles from sign-up metadata.

## 3. Google callback and email auth settings

Configure the Google OAuth client in Google Cloud and enable it in Supabase Auth. Keep Google client credentials in Supabase's provider configuration.

- Google authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
- Supabase Site URL: the chosen staging application origin.
- Supabase allowed application redirects: `http://localhost:3000/auth/callback` and the exact staging `/auth/callback` URL. No wildcard production redirects.
- The application's PKCE callback is implemented. Merely adding an allowlist is not a passed login test: finish a real Google consent/callback journey. The callback uses `NEXT_PUBLIC_APP_URL`; consistently use that hostname for the browser flow.
- Keep email confirmation enabled. The application uses server-side Supabase-generated verifiers and sends its own verification/reset/invite messages through Resend. These application flows do not require Supabase SMTP. Direct Supabase SDK/dashboard email flows are separate and require their own SMTP/templates if used.
- Set `GOOGLE_OAUTH_CONFIGURED=true` only after provider configuration, not as a substitute for it.

[Supabase Google guidance](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) and [SSR client guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client) describe these two different redirect boundaries.

## 4. Cashfree sandbox

Set `CASHFREE_ENV=sandbox`, merchant sandbox credentials and the explicit API version `2026-01-01` from [Cashfree's current API overview](https://www.cashfree.com/docs/api-reference/payments/latest/overview). Keep real checkout disabled.

Deploy the staging application with its staging Supabase values and Cashfree sandbox secret. Set `INTEGRATION_PUBLIC_URL` to that publicly reachable HTTPS origin. Register `/api/webhooks/cashfree` in Cashfree and make sure deployment protection does not block the provider's requests.

```powershell
npm run providers:cashfree
```

This creates a synthetic sandbox order only; it does not charge a real customer. The response is saved privately in the ignored artifacts directory. Use Cashfree's documented sandbox checkout to complete a test payment; checkout UI integration belongs to Phase 3. Verify a signed event reaches `webhook_events`, then replay it and confirm only one inbox row exists.

The receiver verifies [Cashfree raw-body HMAC signatures](https://www.cashfree.com/docs/payments/online/webhooks/signature-verification), returns 503 when unconfigured/unable to store, 401 for invalid signatures and 200 only after durable storage or a recognised duplicate. It does not treat receipt as a paid purchase. Phase 3 must consume the inbox, validate order/amount/currency and make grant processing idempotent by payment/order identity. Retention/redaction of customer-containing inbox payloads also needs to be configured before production.

## 5. VdoCipher test lesson

Upload an authorised lesson and wait for encoding. Configure `VDOCIPHER_API_SECRET` and `VDOCIPHER_TEST_VIDEO_ID`.

```powershell
npm run providers:video
```

The script requests a short-lived OTP with a test watermark and writes private playback HTML. Open it promptly on the intended test browser; if domain restrictions reject a local file, serve the artifact through a temporary loopback-only HTTP server with a permitted test domain. Do not move it into the app's public directory. Regenerate the token on expiry. Use an authorised device-accessible staging test arrangement for physical phones; the default local app server is loopback-only.

Record actual Chrome/Android and Safari/iPhone playback, watermark visibility, allowed speed/quality controls and any plan/browser restrictions. Issuing an OTP does not prove these. See [backend OTP documentation](https://www.vdocipher.com/docs/server/playbackauth/otp/).

## 6. Resend

Verify the sending domain's DNS in Resend. Configure `RESEND_API_KEY`, a plain sender address in `RESEND_FROM_EMAIL`, and an operator-owned recipient in `PROVIDER_TEST_EMAIL`. A restricted sending-only API key may not list domains; use the dashboard for domain verification rather than unnecessarily broadening production credentials.

```powershell
npm run providers:check
npm run providers:email
```

The second command deliberately sends one test email. Alternatively, `npm run test:email` sends one operator message and checks its delivery event. The earlier HTTP 403 was resolved for the configured testing sender: a subsequent operator message was accepted and reported delivered. This does **not** authorise email to general student addresses. Verify a business sender domain/DNS and key permissions before sending those messages. The read-only probe checks the first domain-list page; inspect further pages in the dashboard if needed. Confirm actual inbox arrival, not only API acceptance. See [Resend domain API](https://resend.com/docs/api-reference/domains/list-domains) and [provider errors](https://resend.com/docs/api-reference/errors).

For testing without a domain, Resend's testing sender is restricted to the account owner's authorised test recipient; it cannot support general student signup. Do not assume a personal mailbox domain can be verified. Use a domain you control before student access is opened. See [Phase 2 status and runbook](./PHASE-2-STATUS.md) for confirmation/reset lifetimes and administrator setup.

## 7. Acceptance and operations

Run configuration checks again, then `npm run check`, `npm run format:check` and `npm run build`. Record real versions, migration confirmation and safe provider event evidence in [the Phase 0 report](./PHASE-0-STATUS.md). No secrets, complete payloads or personal information in evidence.

Budget remains owner-unconfirmed: database compute/backups, Vercel usage, video storage/bandwidth/DRM, email quotas and future rate-limit/monitoring services all need an agreed cap. Start with the plan's traffic hypothesis, not unlimited usage. No paid subscription has been purchased during this phase.
