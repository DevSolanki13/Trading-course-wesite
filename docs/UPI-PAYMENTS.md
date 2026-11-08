# Academy UPI checkout through IndianXtrade

Academy uses the **same UPI ID, collection bank account and existing payment gateway as IndianXtrade**. IndianXtrade's gateway code, bank-feed endpoint, amount allocator and live settings are unchanged. Only UPI is offered for new Academy purchases; historical orders remain readable.

## Shared-account design

Academy creates a deposit using IndianXtrade's existing authenticated `/api/deposits` API. That gateway reserves an exact amount across **both** websites. The Academy order stores the returned checkout reference and validates the gateway's UPI link against the saved total and receiving account. The existing Android SMS/PhonePe relay confirms the payment in IndianXtrade as usual. Academy polls the owner-authenticated deposit status and grants course access only when it is `COMPLETED`.

Do not run independent amount allocators on the same UPI account or forward the same bank credit into two independent settlement systems. In shared mode, Academy's direct bank-feed consumer stays disabled, including during pilot testing. The Android app sends alerts to IndianXtrade only. There is no need to change IndianXtrade's gateway or create a separate bank account.

A dedicated technical collector user holds Academy payment deposits in IndianXtrade. It has ordinary user permissions, no live trading access, and an exception allowing its server API calls through the network guard. Its funds are internal collection accounting and must not be traded or withdrawn through automation. Credentials and the existing relay secret are held in ignored private rollout files; collector credentials are never bundled into the APK or committed to Git. The owner’s private APK is preconfigured with the existing relay credential from ignored build-time environment; it must not be distributed publicly. Sessions refresh through the existing login API when required.

## Deployment

1. Apply Academy migrations `202611080022_upi_payments.sql`, `202611080023_shared_upi_gateway.sql`, and `202611080024_gateway_upi_uri.sql` in order. These change only Academy's schema. Migration 023 adds a private gateway-reference binding and prevents the old Academy SMS consumer from settling shared-gateway intents.
2. Configure the following Production variables in Academy's Vercel project:

   ```dotenv
   PAYMENT_PROVIDER=upi
   PAYMENT_MODE=upi
   ALLOW_MOCK_PAYMENTS=false
   ALLOW_TEST_PAYMENTS=false
   UPI_GATEWAY=indianxtrade
   UPI_PAYMENTS_ENABLED=off
   UPI_RELAY_ENABLED=off
   UPI_PILOT_USER_IDS=<authenticated pilot student UUID>
   UPI_COLLECTION_VPA=<same real UPI ID as IndianXtrade>
   UPI_PAYEE_NAME=<same payee name as IndianXtrade>
   INDIANXTRADE_COLLECTOR_EMAIL=<technical collector account>
   INDIANXTRADE_COLLECTOR_PASSWORD=<private collector credential>
   INDIANXTRADE_SESSION_TOKEN=<initial private session; refreshed by login when needed>
   ```

3. Save and redeploy Production. Existing database, email, video and login variables stay in place. `/api/health` reports public checkout readiness without exposing credentials or pilot IDs.
4. Install the preconfigured Android APK on the operator phone. The owner taps **Grant access**, allows Android’s permission prompts, then taps **Start listening**. Both businesses are handled automatically with separate status rows; no technical settings or credentials are entered on the phone. Verify the new app before disabling the old relay; gateway UTR deduplication protects against duplicate delivery while both are installed.
5. With public checkout still off, pay the exact QR amount as the allowlisted pilot student. Confirm the real bank reference, gateway deposit, Academy paid order, enrollment, printable receipt, and receipt email delivery. Automated local tests and an emulator install do not prove real payment delivery.
6. Set `UPI_PAYMENTS_ENABLED=on`, clear the pilot allowlist and redeploy. Verify the live health endpoint and a regular authenticated student's UPI-only checkout.

Private, ready-to-save owner handoff files live under ignored `artifacts/upi-rollout/`: `vercel-settings.md`, `academy-shared-upi.env`, and `android-settings.md`. Never publish those files.

## Amounts, expiry and recovery

- IndianXtrade's existing minimum deposit is INR 500. To keep its positive paise offset from charging above a course total, shared Academy checkout currently requires an invoice total of at least INR 510. It requests the course total minus INR 10 and accepts only an exact amount within INR 19.99 below the invoice total. The difference is recorded as a discount; QR, saved total and receipt agree. Coupon totals below INR 510 fail before creating a gateway deposit.
- The Academy QR is hidden after 50 minutes, ahead of the existing gateway's 60-minute reservation window. A replacement checkout is not created while the bound gateway payment is still pending. A completed gateway deposit is reconciled before a retry can create another course order. Never pay an expired QR or pay twice while confirmation is pending.
- Duplicate confirmations use the same gateway checkout reference as the payment identity; purchase settlement, enrollment and receipt outbox are atomic and idempotent. Customer-supplied payment data, UTR claims and screenshots cannot grant course access.
- A failed setup can leave an unused reservation at IndianXtrade if the network fails after creation but before Academy receives the response. No payment link has been presented in that case; the reservation expires normally. Creation claims and existing gateway rate limits limit retries.
- The existing API limits apply: collector creation is limited to ten deposits per five minutes; deposit-status polling is limited to sixty per minute. Academy polls every fifteen seconds and fails closed on throttling or gateway errors. Higher-volume operation needs an explicitly reviewed gateway API capacity change; this integration does not alter IndianXtrade's limits.
- Public checkout can be closed while bound payments continue to reconcile through the authenticated status API. Funds are never refunded or withdrawn by the integration. An operator must verify and return funds through the bank when a refund is approved, then reconcile course access using existing tooling.
- GST-enabled real orders retain the existing approved-invoice configuration gate. Receipt email requires a working configured sender; a queued outbox entry alone is not proof of inbox delivery.

## Checks

Run `npm run check`, `npm run test:unit`, `npm run format:check`, `npm run build`, and the Android typecheck/native routing tests. Tests cover authenticated pilot gating, shared allocation API use, exact QR amount/account validation, session recovery, owner-only binding, completed-only settlement, duplicate credits, course access and denial of the old Academy SMS path for shared intents. Browser suites include historical UI expectations and must be assessed against current route behavior; report failures rather than treating local test success as proof of live payment completion.
