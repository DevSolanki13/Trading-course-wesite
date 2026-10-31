# Phase 3: local commerce implementation and provider acceptance

Updated 31 October 2026. **The local Cashfree sandbox implementation, refund workflow, billing documents, transactional queues and scheduler integration are delivered. Actual Cashfree acceptance and live sales remain disabled.** This supersedes the earlier demo-only implementation description. See [Phase 6](./PHASE-6-STATUS.md) for the preceding local verification and external blockers.

## What is implemented

| Area              | Local implementation                                                                                                                                                                                                                               | External acceptance still required                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Cashfree checkout | Server-owned price/sale-price, verified admitted session, phone validation, stable order UUID/idempotency key, fixed sandbox API host, one-hour order expiry and scoped hosted SDK page                                                            | Real sandbox account, domain/redirect setup and SDK/network behavior                            |
| Confirmation      | Raw-body HMAC before parsing; minimal inbox references; authenticated Get Order/Get Payments reconciliation; amount/currency/customer/order validation; independent attempt identities                                                             | Actual signed webhook delivery, provider retries and reconciliation                             |
| Entitlement       | SQL atomically confirms payment, creates one matching enrollment, stores the immutable billing snapshot and queues one purchase email. A failed grant rolls the entire transaction back                                                            | Apply migration 009 to an authorised, reconciled staging target and verify through the app      |
| Retry behavior    | Failed/user-dropped attempts leave the Cashfree order pending. Successful attempts require provider PAID/SUCCESS and a completion timestamp. Expired/terminated orders close without access. Paid/refunded orders cannot be downgraded/reactivated | Real failed → retry → success, delayed webhook and browser-close acceptance                     |
| Refunds           | Approved full-order refunds use one persistent reference; GET before POST; ambiguous timeouts remain processing and retain access. Only validated provider SUCCESS calls the existing atomic refund/revocation/community/email workflow            | Real sandbox refund, pending/rejection/timeout acceptance; production dispatch remains disabled |
| Billing           | Private PDF and escaped UTF-8 HTML downloads, ownership/admitted-session checks, immutable purchase snapshots, separate confirmed-refund credit note, Latin/Hindi fonts bundled with licence                                                       | Owner-approved business/tax details and actual hosted download/access tests                     |
| Email             | Purchase/closed-checkout/refund messages persist independently of delivery. Shared retry policy uses provider idempotency, claim ownership, expiry and backoff                                                                                     | Verified sender, actual inbox delivery and delivery-event acceptance                            |
| Operations        | Protected `/api/operations/run`, sandbox reconciliation jobs, notification sending behind a separate flag, aggregate monitoring/attention responses, bounded requests and durable claims                                                           | Hosting/scheduler access, cadence and alert destination                                         |

Payment and refund network contracts were checked against the official [Create Order](https://www.cashfree.com/docs/api-reference/payments/latest/orders/create-order), [Get Order](https://www.cashfree.com/docs/api-reference/payments/latest/orders/get-order), [Get Payments](https://www.cashfree.com/docs/api-reference/payments/latest/payments/get-payments-for-an-order), [Create Refund](https://www.cashfree.com/docs/api-reference/payments/latest/refunds/create-refund), [Get Refund](https://www.cashfree.com/docs/api-reference/payments/latest/refunds/get-refund), [webhook idempotency](https://www.cashfree.com/docs/payments/online/webhooks/webhook-indempotency), and [refund webhook](https://www.cashfree.com/docs/api-reference/payments/latest/refunds/webhooks) documentation. API version is pinned to `2026-01-01`.

## Important boundaries

- The application supports **sandbox only**. `PAYMENT_MODE=cashfree`, production stage, Vercel production environment, missing credentials or a different API version do not enable checkout. The adapter cannot call a production/custom API host.
- GST-enabled checkout is deliberately rejected until the required approved invoice inputs and tax classification are supplied. The renderer supports invoice/receipt/credit-note snapshots, but every generated document is marked **SANDBOX — NOT A LIVE TAX DOCUMENT**. It is not a claim of statutory invoice compliance.
- Only a full-order, single-refund response is accepted. Partial/split refunds, automatic gateway refunds, chargebacks/disputes and live payment support are outside this delivered local workflow and need explicit implementation/acceptance before enabling those merchant features.
- Existing coupons can be managed in Admin, but coupon redemption is still not connected to checkout. Do not advertise discount codes as usable.
- Historical paid orders do not get fabricated invoices or emails during migration. Missing historical documents are surfaced for review; a verified backfill procedure is still needed if actual historic purchases exist.
- A provider's email acceptance is not inbox delivery. No real student email, payment, refund, shared migration, hosting change or domain purchase was performed in this session.
- Email retries use a saved first-delivery timestamp and stop after 23 hours; [Resend's idempotency window is 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys). Older ambiguous sends are surfaced for operator review rather than automatically sent with an expired key.
- The existing demo workflow remains available only through its separate explicit configuration. Its terminal-state rules differ from Cashfree's multiple-attempt order model; it is not used as proof of real provider acceptance.

## Migration and local evidence

[Migration 009](../backend/database/migrations/202610310009_commerce_operations.sql) is new and **has not been applied to the shared database**. It adds private billing documents/jobs, restricted commerce RPCs, atomic notification/document triggers, job leases/retries and aggregate monitoring. All nine migrations execute in disposable PGlite tests. Do not modify/replay migrations 001–008 to install it.

Local evidence:

- `npm run check`: lint, strict TypeScript and **35 Node tests** pass.
- `npm run test:unit`: **10 React tests** pass, including sandbox SDK invocation and recoverable SDK errors.
- `npm run build`: production build passes, including new payment/document/operations routes.
- `npm run test:release`: **32 production-browser tests** pass across mobile/desktop and dark/light, including anonymous billing denial and disabled scheduler/sandbox routes. These use synthetic configuration, not real Cashfree checkout.
- Formatting passes. npm reported zero known vulnerabilities when the PDF dependencies were installed.
- `npm run operations:run` dry run passes and makes no network request or queue claim.

The new tests cover failed-attempt retry, amount/currency/customer validation, duplicate payment identity, immutable document totals, grant-failure rollback, refund timeout recovery without a second POST, claim ownership, scheduler authentication, HTML escaping, Hindi PDF generation and private billing access decisions. Real multi-connection database concurrency and real provider calls remain staging acceptance work.

## Configure staging only after resolving its trust/ledger

1. Restore trusted Supabase database access and compare the actual schema with the migration ledger. Restore access to the intended Vercel staging project. Follow [the operational runbook](./OPERATIONS-RUNBOOK.md).
2. Review migration 009 and apply it only with shared-database authorisation. Run `npm run db:verify` afterward. The verifier now checks 28 RLS tables and the new service-only commerce functions.
3. Set `PROJECT_STAGE=staging`, `PAYMENT_MODE=cashfree-sandbox`, `CASHFREE_ENV=sandbox`, `CASHFREE_API_VERSION=2026-01-01`, the sandbox merchant credentials and the exact HTTPS `NEXT_PUBLIC_APP_URL` in protected settings. Keep production keys absent.
4. Register `/api/webhooks/cashfree` for payment and refund status events. Whitelist the exact staging domain/redirects as required. Configure the edge controls to admit authenticated provider callbacks.
5. Set `OPERATIONS_ENABLED=true` and a unique random `CRON_SECRET` of at least 32 characters. For the staging preview, use a protected external scheduler or the operator CLI to send GET `/api/operations/run` with `Authorization: Bearer <CRON_SECRET>`. A five-minute cadence is a starting proposal, not a configured service. Vercel Cron uses the same secret convention but requires a production deployment; the current worker deliberately rejects Vercel production environments. Production enablement and its hosting plan/cadence must be accepted separately. See [Vercel's scheduling guidance](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
6. Leave `NOTIFICATION_DELIVERY_ENABLED=false` until the sender and recipients are approved. Only then explicitly opt in. The current application still refuses production job processing.
7. Complete a disposable sandbox purchase → webhook → enrollment → PDF/HTML → actual lesson acceptance → approved full refund → revoked access/credit-note/email exercise. Include webhook loss/retry, wrong totals, duplicate/out-of-order attempts, SDK failure and a browser closed before redirect.

For manual scheduling, `npm run operations:run` is a dry run; `npm run operations:run -- --run` explicitly calls the configured protected staging endpoint. It prints aggregate counts only. The CLI must never receive the secret as a command-line argument.

## Still needed before public sales

Staging trust/ledger and project access; actual sandbox acceptance; approved courses/videos and physical-device DRM; business/tax/policy approval; verified sending and actual receipt/refund delivery; production-specific payment/worker enablement after acceptance; coupon redemption if advertised; production WAF/alerts, backup/restore/load acceptance and domain/DNS. The current code intentionally cannot accept a live payment.
