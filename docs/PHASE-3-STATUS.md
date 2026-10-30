# Phase 3 — Demo payments

The checkout is available only when `PAYMENT_MODE=demo` and `PROJECT_STAGE` is not `production`. Server-side checkout computes integer-paise totals, creates a pending order and payment attempt, and the neutral hosted demo page sends an HMAC-signed event through the same webhook confirmation path used by a real provider. Paid events create the enrollment; browser redirects never grant access.

## Swap to Cashfree

1. Implement `CashfreeProvider` in `backend/payments/demo.ts` using the Cashfree order and webhook APIs.
2. Keep `PaymentProvider` and the checkout route unchanged; select the provider from the environment.
3. Replace the demo webhook adapter with Cashfree's verified raw-body signature handler and map events to `PaymentEvent`.
4. Set `PAYMENT_MODE=cashfree`, configure Cashfree credentials and webhook URL in Vercel, then test sandbox purchase, retry, duplicate delivery, failure and refund flows before production.
