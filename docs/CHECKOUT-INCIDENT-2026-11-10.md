# Checkout validation failure: investigation and repair plan

Date: 10 November 2026. The initial investigation below is preserved as a record; implementation status follows at the end.

## Finding

Academy rejected the gateway's payment instructions during QR preparation. The exact screenshot message is thrown in `backend/payments/indianxtrade.ts:138–146`. It combines five validation failures into one error: invalid amount format, non-INR currency, amount below the allowed range, amount above the saved total, or an unexpected receiving UPI ID (VPA).

The leading hypothesis is receiving-account configuration drift. A concrete integration mismatch exists in the inspected source: IndianXtrade randomly chooses from `UPI_COLLECTION_VPAS`, while Academy accepts only the singular `UPI_COLLECTION_VPA`. A legitimate gateway reservation for another configured account therefore produces this exact error. This can be intermittent if Academy's one account is also in the gateway's pool, or consistent if it is absent.

**This does not establish the exact cause of the production incident.** The screenshots contain neither the returned UPI instructions nor the saved order or production configuration. The local gateway checkout inspected below is not proof of the deployed revision. Production evidence is needed to distinguish the five failing conditions.

## Evidence and sequence

1. Both screenshots show Basic to Advance at ₹1,999, coupon NIKHIL reducing it by ₹500, GST ₹0, and a displayed total of ₹1,499.
2. Clicking Generate UPI QR calls `POST /api/purchase/create`. The browser reports HTTP 503.
3. `createPurchase` saves/reuses an order, then `bindGatewayPurchase` claims payment creation and passes the **saved order amount** to `IndianxtradeGateway.create`.
4. The adapter creates a remote deposit, receives its token, fetches the hosted checkout, and extracts a UPI link or decodes its PNG QR.
5. This particular error means the adapter reached validation after extracting exactly one UPI URI. Authentication errors, failed upstream HTTP responses, missing QR images, and database binding conflicts have different error paths.
6. The validation error prevents `purchase_upi_gateway_bind` from running. No QR from this failed attempt is returned to the student by this path.
7. `backend/handlers/purchase.ts:189–197` logs the exception and maps an otherwise unclassified error to 503. This status alone does not demonstrate a gateway outage.

The screenshots do not establish that money moved, that the account was unsafe, or that the student had no earlier payment attempt.

## Amount analysis

The inspected gateway's `amountInr` API field is explicitly **paise**, despite its name. Academy passing an integer paise amount is correct; dividing this request by 100 would introduce a new bug.

For a saved total of ₹1,499:

| Step                                     | Amount                      |
| ---------------------------------------- | --------------------------- |
| Saved total                              | 149,900 paise               |
| Academy deposit request: total minus ₹10 | 148,900 paise               |
| Gateway allocator offset                 | −999 through +1,000 paise   |
| Resulting possible QR amounts            | ₹1,479.01 through ₹1,499.00 |
| Academy accepted range                   | ₹1,479.01 through ₹1,499.00 |

These ranges agree. The coupon total also exceeds the ₹510 minimum. The presence of a coupon is therefore not sufficient to explain this failure. A production allocator change, a different saved amount, malformed currency/amount, or account mismatch can still explain it.

The current intended behavior is to record any allocator reduction as an additional discount when binding, so the saved final amount, QR and receipt agree. This report does not propose changing that pricing policy.

## Confirmed weaknesses

| Weakness                                                          | Consequence                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Gateway supports multiple collection VPAs; Academy validates one  | Legitimate rotated accounts can be rejected                                                |
| Five validation conditions share one exception                    | Existing logs cannot identify the failed condition from this message                       |
| Token is returned to the caller only after QR validation          | A validation failure loses the received remote reference before durable binding            |
| Creation claim lasts two minutes and has no failure handling here | An immediate retry reports setup pending; later retries can reserve another remote deposit |
| Frontend receives only an error on failed creation                | The customer has no direct link to the saved order from this failure response              |
| Tests use a fixed VPA and mostly mocked gateway results           | Passing tests do not detect production account-pool drift                                  |

The display-only bank mirror also filters unmatched credits by one configured VPA (`backend/scripts/sync-academy-upi.py`). Supporting multiple approved receiving accounts in checkout must cover that filter and its operational configuration too.

## Repair plan

### 1. Confirm the incident before choosing a configuration repair

- Correlate the production request near 09:56 IST with its deployed revision, authenticated saved order and collector deposit. Use existing authorized operational access; avoid creating deposits merely to investigate.
- Compare saved amount and coupon snapshot with the QR's amount, currency and receiving VPA, plus the gateway reservation time/status. Check the complete approved gateway collection pool against Academy's deployed account setting.
- Record which predicate failed. If the remote token was not retained, correlate collector deposits by time and requested amount, but do not use amount alone as authority to bind or settle an order.
- Confirm whether the failure is limited to an account, coupon, student or deployment. The screenshots alone cannot establish outage breadth.

### 2. Repair the collection-account contract

- Prefer an explicit, operator-approved Academy allowlist containing the intended gateway collection VPAs. Preserve the existing singular setting as a compatible one-account configuration.
- Validate configuration strictly and normalize whitespace and case consistently. Validate every newly returned URI against this approved set; never automatically trust a VPA simply because it appeared in a gateway response.
- Store the exact validated destination on each intent. Preserve existing bound instructions when collection settings change; retiring accounts requires an explicit operational policy for outstanding payments.
- Extend environment checks, health readiness, deployment documentation, fixtures, and the bank mirror's unmatched-credit filter to the same intended approved account set. Static readiness should state configuration validity, not imply a completed payment probe.
- If operations deliberately requires one collection account, first verify that the gateway can route this collector to that account. Merely changing Academy's setting cannot fix random selection from a larger pool. Avoid changing the shared gateway's global account pool as an incidental Academy fix.

### 3. Make failed setup recoverable

- Persist the remote token immediately after a successful create response, in private setup-attempt fields associated with the order and creation claim. Keep this distinct from a validated, payable intent; an unvalidated token must never grant access or expose a payment QR.
- Store the original creation time and retry that known reservation's validation/binding. Reusing a token must not reset or extend its payment deadline.
- Use the existing database claim to serialize creation and conditional state updates. Keep the saved price/coupon fixed while a reservation or ambiguous setup attempt is active; return the saved quote to the UI.
- Distinguish failures before sending the create request, failures with a known token, and an ambiguous timeout after a create request was sent. Release/retry safely for the first case; resume the known reservation for the second. For ambiguous creation, retain a bounded recovery state and reconcile through supported owner-authenticated facilities or allow expiry before replacement. Do not blindly repeat a possibly successful create request.
- Reuse upstream idempotency if it is actually supported. The inspected gateway contract provides no creation idempotency key, so Academy cannot promise exactly-once remote creation after a lost response. Do not claim a local claim alone solves that distributed failure.
- Reconcile paid/pending reservations before replacement. A definitive validation failure should remain quarantined for inspection; preserve its reference and let it expire or use a supported cancellation action. Never enable payment for it by weakening validation.

### 4. Make errors actionable

- Introduce internal reason codes for amount format, currency, amount range, account mismatch, QR extraction, upstream outage and setup already in progress.
- Log order ID, deployment/correlation ID, expected/actual integer amounts, currency and a masked or hashed account identifier. Keep passwords, session cookies, raw tokens, full payment URIs and hosted checkout HTML out of logs and client errors.
- Return a safe student message, support reference, owned saved-order link and explicit retryability. Preserve the specific reason in server logs. Use a distinct setup-conflict response with retry timing; distinguish invalid upstream instructions from transient gateway unavailability instead of mapping everything to generic 503.
- Keep the button consistent with recovery state: resume/check the saved order while setup is pending. Show the saved final price/coupon when returning an existing bound order. Do not imply that repeated QR creation repairs an account mismatch.

### 5. Validate and release

- Add regression cases for every approved VPA, an unapproved VPA, whitespace/case normalization, missing or non-INR currency, malformed/duplicate UPI parameters, and full-price/coupon totals. Keep overcharge rejection intact; use integer paise validation.
- Test both ends of the allocator range, ₹510 minimum, below-minimum coupon totals, and a stale displayed quote versus a saved order. Confirm QR, final total and receipt agree.
- Test validation failure after a received token, bind failure, ambiguous create timeout, claim expiry, repeated clicks, concurrent requests, reload/resume and expired reservations. Assert that a known reservation is reused and that an unvalidated reservation cannot settle or leak its QR.
- Retain owner-only status, completed-only settlement, replay protection and atomic enrollment/receipt checks. Add bank-mirror coverage for every approved account if multiple accounts are enabled.
- Run the repository checks appropriate to the implementation, including database migrations, unit/UI tests and a production build. Use a recorded sanitized gateway checkout fixture so page changes are covered as well as hand-built mock links.
- Release to an allowlisted pilot first. A real payment through each approved route should verify collector completion, the matching Academy order, enrollment, receipt and actual email delivery. Expand only after reason-code logs and recovery behavior are verified. Preserve reconciliation of existing payments if new checkout creation is disabled during rollback.

## Verification completed during this investigation

- `node --test --experimental-strip-types tests/indianxtrade-gateway.test.ts`: 5 passed.
- `npx vitest run tests/shared-upi-purchase.test.tsx tests/upi-gateway-reconciliation.test.tsx`: 7 passed.
- `node --test --experimental-strip-types tests/upi-payments.test.ts`: 4 passed, including migration-backed reservation/binding/settlement checks.
- Temporary in-memory reproductions accepted both allocator endpoints for ₹1,499. They reproduced the exact screenshot error with a different VPA, a QR inconsistent with the saved total, and missing currency. No files or deposits were created by these reproductions.

Source references: Academy adapter, purchase service, binding helper, handler, migrations 022–024, checkout component and bank mirror in this repository. The related gateway source was inspected read-only at `/Users/solminde/Developer/Personal/AMScoins/asmtrading`: `packages/contracts/src/deposit.ts`, `packages/db/src/repositories/deposit.ts`, `apps/web/src/app/api/deposits/route.ts`, `apps/web/src/app/checkout/[token]/page.tsx`, and `apps/web/src/lib/{upi,upi-collection}.ts`.

Not checked during the investigation: production logs/configuration/database, deployed gateway revision, browser reproduction or a real payment. The account mismatch remains a leading hypothesis until production evidence confirms it.

## Implementation completed locally

- Academy supports the same multiple receiving accounts as IndianXtrade through `UPI_COLLECTION_VPAS`. It accepts and preserves the QR for whichever approved account the gateway selects. The previous singular variable remains a fallback; it does not constrain multi-account deployments.
- The full account list is validated, normalized and checked by checkout configuration/health readiness. The display-only bank mirror accepts the corresponding `vpas` array and includes unmatched credits from all approved accounts.
- New migration `202611100028_gateway_setup_recovery.sql` stores private setup attempts separately from payable intents. Creation is serialized, remote references are saved before QR validation, known references resume without another deposit, and the original expiry is preserved. Quotes cannot change during setup.
- An uncertain creation without a durable reference is protected for the gateway reservation window plus a safety margin. Definitive pre-creation failures can retry safely. Expired known reservations require an authenticated upstream terminal state before cancellation; an unvalidated token cannot settle an order.
- Checkout responses have reason codes, retry timing and support references. Server logs include safe amount/account diagnostics. The student sees the saved quote/coupon and a recovery link; blocked or unverified QRs remain hidden.
- Regression coverage includes both account routes, a PNG QR for the second account, coupon/minimum amount boundaries, duplicate parameters, repeated clicks, validation/binding/storage failures, ambiguous responses, ownership/privilege checks, setup expiry and bank mirror filtering.

Validation: `npm run check` passed (lint, type checking, 63 backend/database tests); `npm run test:unit` passed (148 tests); `npm run build` passed. The final strengthened QR, quote-freeze and repeated-click assertions also passed their targeted reruns. Changed supported files pass formatting checks.

Production has not been changed. Deployment requires applying migration 028, deploying this application revision, setting the same complete approved account list used by IndianXtrade, updating the bank mirror configuration/script, and verifying a pilot payment on each receiving route. See `docs/UPI-PAYMENTS.md` for deployment order. A live payment and confirmation of the original production incident remain outstanding operational checks.
