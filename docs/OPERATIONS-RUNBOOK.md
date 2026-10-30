# Release and operations runbook

Updated 31 October 2026. Read [Phase 6 status](./PHASE-6-STATUS.md) first. This is an operational procedure; writing it does not establish that the production services or restore drill passed.

**Commerce implementation update:** [Phase 3](./PHASE-3-STATUS.md) documents the sandbox order/settlement/refund flow, private PDF/HTML billing and credit notes, transactional notification queues and protected `/api/operations/run` endpoint. Migration 009 is tested locally but unapplied. Restore trust/ledger and obtain migration authorisation before shared application. Actual merchant/inbox/hosted acceptance and production enablement remain open.

## Safe local release check

Use Node 22.19.0 or newer and the npm lockfile. On a new checkout run `npm ci` and `npx playwright install chromium`, then:

```powershell
npm run verify:release
npm run format:check
npm run test:performance
```

The browser and performance commands launch their own production processes with synthetic configuration. Do not reuse these synthetic settings as deployment credentials. The CI workflow runs checks, React tests, formatting, build and the isolated browser suite. It uploads only `artifacts/phase-6/`, not the rest of the operator artifacts. Performance is a separate local command so shared-runner variability does not silently change the agreed lab evidence.

`/api/health` proves that the application process can answer, not database readiness, payment settlement, email delivery or DRM playback. Do not alert solely on its HTTP 200.

## Staging database, TLS and migration drift

1. Verify `PROJECT_STAGE=staging`, the exact Supabase project URL and the corresponding direct/session-pooler URL. Use port 5432 for the session pooler.
2. Download the project's CA from its Supabase Database Settings using trusted dashboard access. Keep it outside `public/`. Set the local `DATABASE_CA_CERT_PATH` to that file, or supply Node's `NODE_EXTRA_CA_CERTS`. The connection helper also accepts URL `sslrootcert`. See [Supabase SSL guidance](https://supabase.com/docs/guides/platform/ssl-enforcement).
3. Run `npm run db:verify` and `npm run ops:check`. Both are read-only and return nonzero when acceptance fails. They disclose migration filenames/counts, not user data or credentials.
4. If a checksum differs or an entry is missing, stop migration work. Compare the checked-in migration, ledger and actual tables/constraints/functions using a read-only connection. The old ad-hoc shortcuts may have altered schema without recording it in the standard ledger; that is a possibility to inspect, not a proven diagnosis.
5. Prepare a reviewed forward migration or a documented ledger reconciliation only after the actual applied schema is proven. Never change an applied source migration, replay an existing `create function`, or insert the expected checksum merely to make verification green. Apply shared schema/ledger changes only with the database owner's authorisation.

The legacy `apply-migrations-007-008.cjs` and `fix-constraint.cjs` commands now refuse mutations. The legacy verification/precheck commands delegate to the read-only verifier. Use the disposable tests for synthetic payment/device/refund mutation scenarios.

## Administrator onboarding and approved course publication

1. Verify the intended owner's account and email. An authorised operator may then use `npm run admin:bootstrap -- --user-id YOUR_VERIFIED_USER_UUID --apply` as described in [Phase 2](./PHASE-2-STATUS.md). Do not run it against an arbitrary student or another project.
2. The owner signs in at `/admin/login`, completes authenticator setup/verification and opens `/admin`. Keep recovery arrangements private. Support must use its own account; never share the Admin session.
3. Create drafts for the two approved courses. Enter the real curriculum, language, prerequisites, integer-paise price and complete durations. Upload authorised videos privately to VdoCipher and verify processing/length before mapping provider IDs.
4. Use Admin publication validation; inspect the catalogue and free preview as a visitor. Paid assets/notes must remain inaccessible without entitlement. Archive test courses using the supported workflow. Inspect anonymous public APIs afterward because a slug-based test-course detector cannot find every fixture.
5. Confirm business/support details, tax treatment and policy wording with the owner. Draft legal pages are not launch approval. See [Phase 5](./PHASE-5-STATUS.md) for Admin/Support limits and refund evidence.

## Hosting, preview isolation and domain cutover

The currently saved staging link is not verified accessible. Restore access to that exact team/project before deploying; do not link to a different default account or create a replacement project silently.

Before a staging deployment, verify the reviewed commit/worktree, target project and preview environment. Configure staging Supabase credentials, exact HTTPS application origin, permitted OAuth redirects, sandbox provider secrets and an approved sender in protected hosting settings. Keep production and preview databases/providers separate. Never upload local environment files or browser auth state. Deployment protection must allow the deliberately configured payment webhook while keeping unrelated private surfaces protected.

Run the browser/API/database checks against the hosted preview with an isolated dataset, then verify HTTPS/HSTS, no-index behavior, canonical/social URLs and authentication callbacks there. Loopback performance results do not establish hosted performance.

Leave real checkout disabled. A production promotion/domain/DNS change comes only after the implementation plan's launch gates pass and the owner approves the concrete release. Domain purchase is a separate paid action; the historical Hostinger results are not current availability or checkout totals.

## Monitoring and incident response

After trust/ledger verification, run `npm run ops:check` from a protected operator machine. The JSON report is saved under `artifacts/phase-6/operations.json` and contains aggregate counts.

| Signal                                                                      | Action                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid active purchase access, missing purchase enrollment or wrong totals | Keep checkout closed; retain the order/provider reference privately; investigate settlement and database state. Never grant access from a return URL or overwrite historic totals                                            |
| Failed/old webhook inbox                                                    | Compare with the provider's authenticated order/payment record; repair/replay through the implemented sandbox consumer/reconciler after actual merchant acceptance. Do not mark an event processed or an order paid manually |
| Old pending payment                                                         | Ask the learner to check the saved order; reconcile with the provider before any retry. Avoid a second charge                                                                                                                |
| Failed/expired/exhausted email claim                                        | Check sender verification, key scope, provider acceptance and queue lease state. Retry only through the worker after fixing the cause                                                                                        |
| Stalled refund                                                              | Inspect the recorded decision and provider reference. Approval is not a completed refund. Sandbox dispatch/reconciliation is implemented; actual merchant acceptance and production dispatch remain disabled                 |
| Open Telegram removal task                                                  | Recheck current paid/manual community eligibility before removal, then record the action in Admin                                                                                                                            |
| Published fixture/test course                                               | Archive via Admin and inspect the public catalogue. Do not delete unrelated data using a slug pattern                                                                                                                        |
| Repeated auth/playback failures                                             | Review redacted application/provider logs; protect accounts, revoke compromised sessions and rotate affected secrets through secure settings                                                                                 |

Before launch, configure a protected scheduler/monitor with an agreed alert destination for these signals, HTTPS errors, authentication failures and provider outages. Schedule queue and reconciliation work with least-privilege credentials and keep webhook traffic out of interactive bot challenges. WAF/bot rules, limits and the alert destination still require deployment setup and acceptance.

## Durable notification worker

The supported sender currently runs only against the verified staging target:

```powershell
npm run notifications:send
# Explicitly sends eligible queued messages, after sender/target review:
npm run notifications:send -- --send
```

The first command is a dry run. With migration 009, the worker claims at most three messages with five-minute leases and persists exponential backoff. Eight attempts exhaust automatic retry. A saved first-delivery timestamp stops automatic retries after 23 hours; [Resend retains idempotency keys for 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys). Older ambiguous sends require provider/operator investigation rather than a fresh key. Completion requires the same attempt and a live lease. Monitoring exposes expired/exhausted/stale-key work.

`npm run operations:run` is also a dry run. Its explicit `-- --run` option calls the protected worker using the secret from private environment settings. The endpoint requires `OPERATIONS_ENABLED=true`, a strong `CRON_SECRET` and staging; email delivery additionally requires `NOTIFICATION_DELIVERY_ENABLED=true`. Both flags default false. Each batch claims up to two reconciliation jobs and three emails, with five-minute database leases, 15-second network timeouts and a four-minute request deadline. Interrupted work remains durable. Configure the actual scheduler/alert destination after hosting access is restored; no schedule was enabled. See Phase 3 for the distinction between a staging scheduler and Vercel production Cron.

`sent` means accepted by the provider, not delivered to an inbox. Confirm delivery separately. Check the provider's idempotency retention before requeuing an ambiguous/old send; an expired provider key may allow a duplicate. No automatic production schedule or unrestricted student-email delivery is enabled. Design a target-verified production worker and delivery-event handling before accepting the corresponding launch gate.

## Backup and restore drill

1. The database owner confirms actual backup/PITR retention, last successful backup, encrypted access and recovery time/data-loss objectives in the provider dashboard. A free plan must not be assumed to include the required retention.
2. Create a separate restore target with isolated credentials/network access. Keep payment webhooks, email workers, scheduled jobs and public indexing disabled there. Do not overwrite staging or production for a drill.
3. Restore using the provider's approved procedure. Database backups do not substitute for private backups of the original videos or a separately verified storage restore.
4. Record start/end time and recovery point; verify migration checksums, row counts, constraints, RLS, staff MFA behavior, purchase/entitlement consistency, progress, refund history, durable notification state and private asset mappings on the restore target.
5. Confirm that the restored app cannot emit real payments, refunds or email. Record redacted evidence, owner, measured recovery time and any missing data. Retire the restore target only under the agreed retention procedure.

This session did not perform a backup or restore. A written procedure is not a passed recovery gate.

## DRM physical-device acceptance

Use real authorised content and a disposable enrolled learner on staging. Record device, OS, browser/version, provider video mapping, result and redacted evidence for Windows Chrome/Edge, Android Chrome and iPhone Safari.

For each: play the free preview, deny a paid lesson as a visitor, play it after a confirmed staging entitlement, inspect the moving watermark, resume, seek/replay and supported speed/quality controls, switch tabs/devices, revoke the session/enrollment and confirm playback stops on the next failed heartbeat. Test allowed and disallowed origins and expired playback credentials. Record screen-capture behavior without promising that a website can block cameras or every recorder. Never publish the OTP, raw video ID, account email or private playback HTML as evidence.

## Handover decision

Review [the status report](./PHASE-6-STATUS.md) with the owner. Keep live sales closed while any content, payment/refund, invoice/tax, email, DRM, recovery or production-operation gate is missing. Local passing tests remain useful evidence without converting the release into an approved public storefront.
