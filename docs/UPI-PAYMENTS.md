# IndianXtrade Academy UPI payments

Academy now supports the same bank-message-confirmed UPI flow used by IndianXtrade: reserve an exact amount, show a QR/deep link, and grant course access only after the operator's Android phone forwards a matching credit. The existing course price, coupon, access expiry, receipt and purchase outbox remain authoritative. Historical Cashfree orders and webhooks remain readable.

## Deployment

1. Apply `backend/database/migrations/202611080022_upi_payments.sql` after the existing migrations using the normal reviewed database migration process. It adds service-only intent/credit tables and expands purchase-provider constraints. No shared database is changed by building or pushing this code.
2. Configure Academy's environment:

   ```dotenv
   PAYMENT_PROVIDER=upi
   PAYMENT_MODE=upi
   ALLOW_MOCK_PAYMENTS=false
   ALLOW_TEST_PAYMENTS=false
   UPI_PAYMENTS_ENABLED=on
   UPI_COLLECTION_VPA=<Academy's UPI address>
   UPI_PAYEE_NAME=IndianXtrade Academy
   UPI_ACCOUNT_MARKERS=<distinct account text present in Academy's credit SMS>
   UPI_RELAY_SENDERS=<bank sender fragments, comma-separated>
   SMS_RELAY_SECRET=<unique random secret of at least 32 characters>
   ```

3. Install the Android app from `apps/payment-relay`. Enter both HTTPS site origins, each site's `SMS_RELAY_SECRET`, and its account markers. Start the relay, allow SMS/inbox/notification permissions, and exempt it from battery optimization. Disable the old relay app once the replacement has been verified; both apps may otherwise forward duplicates (server reference deduplication still applies).
4. Test an actual small payment on each site and verify the correct order/deposit, bank reference, receipt and course access. Only then open checkout for customers. `UPI_PAYMENTS_ENABLED=off` closes Academy's new checkouts and ingestion; drain deliveries before turning it off.

**This implementation requires separate collection accounts with distinguishable text in their bank messages.** Account markers are literal case-insensitive substrings, not regular expressions; use the exact masked account identifier or full VPA, never common words like `credited`, `UPI` or a payee name. Match the server's `UPI_ACCOUNT_MARKERS` to the app's Academy markers. A message identifying zero or multiple destinations is not forwarded and is recorded in phone activity. Do not use two VPAs feeding one indistinguishable account. A shared collection account requires a common amount reservation service and changes to IndianXtrade's deposit allocator before enabling either site's shared-account routing; independent databases cannot safely reserve the same amount.

PhonePe notifications may omit account identity or a usable bank reference. Those cannot auto-confirm payment under this routing model. Use bank SMS containing the configured account marker and UTR, or reconcile the original bank records manually. Never submit a customer-supplied UTR or screenshot as proof of settlement.

## Payment behavior

- Checkout reserves an available amount at or below the saved course total (at most INR 9.99 less); any difference is recorded and displayed as a discount. The QR, saved total, receipt and settlement all use exactly the same paise amount. GST-enabled real orders keep the existing approved-invoice gate.
- Reservations last 60 minutes. Retrying a live order preserves its amount and coupon. An expired order is cancelled when the student creates a replacement; its amount is quarantined for eight days. An expired QR must never be paid.
- Credit insertion, reference deduplication, order confirmation, enrollment and receipt-outbox persistence use one database transaction. Wrong amounts, pre-checkout timestamps, account mismatches, debits, missing references and expired checkouts never grant access. A duplicate reference cannot pay a second order.
- The phone stores routed messages before sending. Failed deliveries survive restarts and are retried on the foreground service's catch-up/network triggers. An unavailable Academy endpoint does not prevent delivery to IndianXtrade. Changing a destination's name/origin leaves old queued messages held rather than forwarding them to another server.
- HTTP 202 acknowledges a persisted/ignored message; storage errors return 503 for retry. Ingestion uses a separate constant-time-checked operator secret, sender/account checks, bounded payloads and rate limiting.
- Polling is owner-scoped, pauses while hidden, stops at expiry or confirmation, and cleans up on navigation. Students can also reopen the saved checkout from order history. Receipt delivery uses the existing durable purchase outbox and is attempted when a paid UPI order is checked.
- Unmatched valid credits remain in `public.upi_credits` for service-operator reconciliation. Missing-reference messages and ambiguous account routing remain on the phone and require the original bank records. Refunds require an operator to return funds through the bank and reconcile access using the existing purchase settlement tooling; the relay does not initiate refunds. No new automated bank-refund API is introduced.

## Verification

Run `npm run check`, `npm run test:unit`, `npm run build` and the app's typecheck/build commands. `tests/upi-payments.test.ts` covers closed configuration, forged browser claims, account routing, unique reservations, immutable coupon retries, owner isolation, transactional rollback, duplicate/conflicting references, expired checkouts, quarantine and course access. Android routing unit tests cover exclusive routing and ambiguity. Local tests and an APK build do not prove real bank delivery or physical-phone background behavior.
