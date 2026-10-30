import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { billingHtml, billingPdf, billingLines } from "../backend/billing/document.ts";
import { canReadBilling } from "../backend/billing/access.ts";
const user = "11111111-1111-4111-8111-111111111111",
  orderId = "22222222-2222-4222-8222-222222222222";
const document = {
  number: `SBX-RC-${orderId.replaceAll("-", "")}`,
  kind: "receipt",
  issued_at: new Date().toISOString(),
  snapshot: {
    orderId,
    courseTitle: "बाजार की समझ <script>alert(1)</script>",
    buyerName: "विद्यार्थी",
    sellerName: "Fixture",
    sellerAddress: "Fixture address",
    sellerGstin: "",
    basePaise: 12345,
    discountPaise: 0,
    taxPaise: 0,
    totalPaise: 12345,
    gstEnabled: false,
    gstRateBps: 0,
    paidAt: new Date().toISOString(),
    currency: "INR",
    sandbox: true,
    taxInvoicePending: false,
  },
};
test("billing documents escape HTML, render private Hindi PDF and preserve exact totals", async () => {
  const html = billingHtml(document);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /विद्यार्थी/);
  assert.ok(billingLines(document).includes("Total: INR 123.45"));
  const bytes = await billingPdf(document);
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-");
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
  assert.throws(() =>
    billingHtml({ ...document, snapshot: { ...document.snapshot, totalPaise: 12346 } }),
  );
});
test("billing ownership denies other users, mismatched documents and unpaid orders", () => {
  const order = { id: orderId, user_id: user, status: "paid" },
    doc = { order_id: orderId, user_id: user };
  assert.equal(canReadBilling(user, order, doc), true);
  assert.equal(canReadBilling("other", order, doc), false);
  assert.equal(canReadBilling(user, { ...order, status: "pending" }, doc), false);
  assert.equal(canReadBilling(user, order, { ...doc, order_id: user }), false);
  assert.equal(canReadBilling(user, order, { ...doc, user_id: "other" }), false);
  assert.equal(canReadBilling(user, { ...order, status: "refunded" }, doc), true);
});
