# P4.7: durable prompt receipt delivery

Policy: deep planning, dependency context, impact verification, no delegation.
Reasons: high-risk payment callers, durable outbox, overlapping ownership.

Scope: receipt scheduling in `backend/purchase/mail.ts`, receipt-only calls in
the purchase handler, checkout success page and Razorpay webhook, operations
schedule, focused tests, and this report. No commits, provider calls, browser,
hosted writes, dependencies, or database changes.

Acceptance: confirmation/webhook responses do not await transport; Next tracks
the prompt attempt; a deployable minute external scheduler example invokes the
retryable worker once activated; existing claims, leases, retries and provider
idempotency stay intact. Hosted activation and recovery acceptance remain gated.

## Implementation and ownership

- Added `schedulePurchaseReceipt` in [mail.ts](../backend/purchase/mail.ts).
  It registers a callback with Next `after`; transport starts after the response.
  Registration failure is contained and leaves the existing outbox row available
  to the worker. The callback returns the delivery promise to Next; there is no
  untracked promise, timer, or self-HTTP request.
- Replaced awaited mail transport at both receipt call sites in the
  [purchase handler](../backend/handlers/purchase.ts), the
  [success page](../app/checkout/success/page.tsx), and the
  [Razorpay webhook](../app/api/webhooks/razorpay/route.ts). Settlement and saved
  paid-status checks still precede registration. Unpaid flows do not register mail.
- Added an every-minute external
  [staging crontab example](../backend/operations/staging-worker.crontab.example)
  invoking the existing `npm run operations:run -- --run` command. Restored
  [vercel.json](../vercel.json) to its original daily schedule; it has no final
  diff and does not supply prompt fallback. Reused the existing
  [worker](../backend/operations/worker.ts) unchanged. Once scheduled against an
  allowed staging target, it claims due notifications independently of checkout
  requests, recovers expired leases, and saves retries.
- The purchase handler overlaps concurrent history work. Only its receipt import
  and two receipt calls belong to this task; history, repository, refund, course,
  learner, and shared-type changes belong to the other owners.

Read the applicable root instructions, gravitas, karpathy, Supabase/Postgres
skills, and installed Next 16.4.3 `after` and route-handler guides. The receipt
callback uses resolved user/order values and does not read cookies or headers.

## Preserved delivery contract

No schema, SQL function, notification template, provider transport, payment
settlement, amount, entitlement, worker authentication, or delivery opt-in changed.
Settlement remains the durable enqueue boundary. Existing `purchase_mail_claim`
and `purchase_mail_finish` still own prompt claims and completion; the sweep still
uses `notification_claim` and its attempt/lease fences. Both paths use the same
saved dedupe key for provider idempotency. Retry backoff, eight-attempt cap,
five-minute leases, and the 23-hour provider-idempotency safety window remain.

An interrupted `after` callback does not lose the receipt: an unclaimed row stays
pending, and a claimed row becomes eligible for sweep recovery after lease expiry.
A failed prompt send retains its existing ten-minute backoff; the minute sweep
checks eligibility without bypassing that backoff. The worker retains its own
exponential retry backoff and three-row claim batch. At low backlog, the next
enabled minute sweep can attempt a newly pending/due row; this is not a delivery
latency guarantee under backlog or provider failure.

## Local verification

Final focused rerun after restoring native cron and adding the external scheduler
example: **18/18 unit tests**, **1/1 isolated outbox backend test**, and typecheck
passed. The broader scoped results below were observed earlier in this task; no
full suite was launched alongside the main agent's full-suite run.

| Check                                                                                                              | Observed result              |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| Focused Vitest: receipt scheduler/callers, worker route, transactional email, shared UPI purchase, checkout status | 5 files, 47 passed, 0 failed |
| Node backend: receipt outbox, operations, purchase access, commerce database, payment providers, Cashfree workflow | 17 passed, 0 failed          |
| `npm run typecheck`                                                                                                | Exit 0                       |
| ESLint on receipt module, all three caller files and all three new tests, `--max-warnings=0`                       | Exit 0                       |
| Editor diagnostics on receipt module and new unit tests                                                            | No errors                    |
| `git diff --check`                                                                                                 | Exit 0                       |

Commands:

```sh
npx vitest run tests/phase4-receipts.test.tsx tests/phase4-receipt-worker.test.tsx
node --test tests/phase4-receipt-outbox.test.mjs
# Earlier broader scoped validation:
npx vitest run tests/phase4-receipts.test.tsx tests/phase4-receipt-worker.test.tsx tests/transactional-email.test.tsx tests/shared-upi-purchase.test.tsx tests/checkout-status.test.tsx
node --test --experimental-strip-types tests/phase4-receipt-outbox.test.mjs tests/operations.test.mjs tests/purchase-access.test.ts tests/commerce-database.test.ts tests/payment-providers.test.ts tests/cashfree-workflow.test.ts
npm run typecheck
npx eslint backend/purchase/mail.ts backend/handlers/purchase.ts app/checkout/success/page.tsx app/api/webhooks/razorpay/route.ts tests/phase4-receipts.test.tsx tests/phase4-receipt-worker.test.tsx tests/phase4-receipt-outbox.test.mjs --max-warnings=0
```

The new tests cover response completion before transport starts (including a held
send), failed sends, missing sender configuration, registration/claim/finish
failures, unpaid paths, authenticated worker execution, unchanged delivery
opt-ins, retry timestamps and stale completion. The isolated migrated PGlite
test exercises competing prompt/sweep claims, wrong-owner rejection, future
backoff, expired-lease recovery, stable idempotency keys and delivery start time,
sent-row exclusion, attempt caps and the delivery-window boundary. Existing
backend tests cover atomic paid access/outbox creation and duplicate settlement.
Provider transport is mocked or injected; no actual provider calls occurred.

Initial test failures were fixture issues (missing JSON content type, jsdom file
URL handling, timestamp serialization, and an undeclared JavaScript helper import).
They were corrected before the passing runs. There was no pre-change full-suite
baseline; these results support the scoped behavior, not a full-release claim.

## Deployment boundary and remaining acceptance

Repository implementation is locally verified; hosted activation is unverified.
No browser, hosted writes, provider sends, dependency changes or commits occurred.

The existing operations policy still requires `OPERATIONS_ENABLED=true`,
`PROJECT_STAGE=staging`, `VERCEL_ENV` other than `production`, and a strong
`CRON_SECRET`. Sending additionally requires `NOTIFICATION_DELIVERY_ENABLED=true`
and configured Resend credentials/sender. These guards were deliberately preserved.
The prompt `after` path retains its previous sender gating, independently of the
sweep opt-in.

The hosting plan is unknown. Per Vercel's current
[cron usage and pricing documentation](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing),
Hobby allows only daily cron jobs and rejects more frequent cron expressions at
deployment. For this reason the native schedule remains daily; an every-minute
Vercel expression was removed from the final change. Pro/Enterprise support minute
intervals, but this implementation does not require or authorize a paid-plan
upgrade. Reviewed the Vercel deployment and CLI
skills (including the cron infrastructure reference) and current official cron
pricing/management docs; no Vercel account access or hosted configuration writes occurred.

**Rollout gate:** provision and activate an external authenticated every-minute
staging invocation using the checked example. The example is not auto-installed
and is not evidence of a deployed schedule. Do not substitute daily-only delivery,
silently upgrade the plan, or claim prompt retries are deployed. Verify the allowed target,
secret, opt-ins, actual scheduler cadence, failed-send retry and expired-lease
recovery before accepting hosted P4.7.

Vercel Cron targets production deployments, while this existing operations route
rejects production invocations. The unchanged daily Vercel configuration supplies
**no prompt fallback** and does not activate an allowed worker under that policy.
An authorized external scheduler
must call the allowed staging `/api/operations/run` endpoint every minute with
`Authorization: Bearer <CRON_SECRET>` (equivalently schedule
`npm run operations:run -- --run` every minute against the staging origin).
Treat timeouts/503s as operational failures and let the next scheduled invocation
retry through the outbox; do not re-enqueue or bypass row backoff. Production
scheduler enablement remains a separate release decision, as in the existing
runbook. Do not mark hosted P4.7 acceptance complete until a permitted prompt
scheduler and recovery are verified in the target environment. See the current
[Vercel cron management docs](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs)
for production-only targeting. Plan eligibility alone does not resolve the route's
production guard.

To install the external example, use a dedicated POSIX scheduler host with
Node >=22.19.0, npm and this checkout's installed dependencies. Replace the example
checkout path, ensure cron's PATH resolves the intended Node/npm versions, review
the file, and install it as that service account's crontab. Configure that account's
environment (or protected local env files read by the existing loader) with the
allowed staging origin and runner policy values, plus the matching `CRON_SECRET`.
The script reads `.env.development.local`, `.env.local`, then `.env`; pre-existing
environment values win. Keep those files access-restricted. Do not set a production
runner to preview merely to bypass policy: the target server must itself permit
staging operations. Sender credentials and delivery opt-in belong on the worker
server. Account for any existing deployment protection without disabling it.
Monitor the command's exit status and aggregate output; timeout/non-2xx returns
nonzero. Repeated/overlapping invocations use the existing claim fences.

The new focused configuration test checks the example's minute cadence, exact
protected command (including explicit `--run`), its package-script mapping, and
the restored daily Vercel entry. No external scheduler was installed or invoked.

Worker recipient identity comes from the claimed outbox row's `user_id`, resolved
through `admin.auth.admin.getUserById`, and requires a confirmed email. It does not
use an HTTP request's email. The prompt path retains the authenticated purchaser's
email, with its database claim scoped to that purchaser's user ID and order ID.
The worker test explicitly checks the outbox-owner lookup and resulting recipient.

Next `after` requires a supported server runtime with invocation lifetime support;
actual post-response timing, platform limits, scheduler execution, Resend
acceptance and email arrival were not tested here. No build or full repository
suite was run; validation was focused on this task's impact.

VERDICT: PASS
