import { z } from "zod";
import "regenerator-runtime/runtime.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const amount = z.number().int().nonnegative().max(2147483647);
export const billingDocumentSchema = z
  .object({
    number: z.string().regex(/^SBX-(RC|CN)-[a-f0-9]{32}$/),
    kind: z.enum(["receipt", "invoice", "credit_note"]),
    issued_at: z.string(),
    snapshot: z.object({
      orderId: z.string().uuid(),
      courseTitle: z.string().max(1000),
      buyerName: z.string().max(1000),
      sellerName: z.string().max(1000),
      sellerAddress: z.string().max(4000),
      sellerGstin: z.string().max(30),
      buyerAddress: z.string().max(4000).optional(),
      buyerGstin: z.string().max(30).optional(),
      supplyState: z.string().max(100).optional(),
      basePaise: amount,
      discountPaise: amount,
      taxPaise: amount,
      totalPaise: amount,
      gstEnabled: z.boolean(),
      gstRateBps: z.number().int().min(0).max(10000),
      paidAt: z.string(),
      currency: z.literal("INR"),
      sandbox: z.literal(true),
      taxInvoicePending: z.boolean(),
    }),
  })
  .superRefine((value, context) => {
    const s = value.snapshot;
    if (
      s.totalPaise !== s.basePaise - s.discountPaise + s.taxPaise ||
      s.discountPaise > s.basePaise
    )
      context.addIssue({ code: "custom", message: "Invalid billing totals" });
  });
export type BillingDocument = z.infer<typeof billingDocumentSchema>;
const money = (value: number) => `INR ${(value / 100).toFixed(2)}`;
export function billingLines(input: unknown) {
  const doc = billingDocumentSchema.parse(input);
  const s = doc.snapshot;
  return [
    "SANDBOX - NOT A LIVE TAX DOCUMENT",
    doc.kind.replaceAll("_", " ").toUpperCase(),
    `Document: ${doc.number}`,
    `Order: ${s.orderId}`,
    `Issued: ${new Date(doc.issued_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
    `Seller: ${s.sellerName || "Business details awaiting approval"}`,
    `Address: ${s.sellerAddress || "Awaiting approved business address"}`,
    ...(s.sellerGstin ? [`GSTIN: ${s.sellerGstin}`] : []),
    `Buyer: ${s.buyerName}`,
    ...(s.buyerAddress ? [`Buyer address: ${s.buyerAddress}`] : []),
    ...(s.buyerGstin ? [`Buyer GSTIN: ${s.buyerGstin}`] : []),
    ...(s.supplyState ? [`Place of supply: ${s.supplyState}`] : []),
    `Course: ${s.courseTitle}`,
    `Base amount: ${money(s.basePaise)}`,
    `Discount: ${money(s.discountPaise)}`,
    `GST (${s.gstRateBps / 100}%): ${money(s.taxPaise)}`,
    `Total: ${money(s.totalPaise)}`,
    `Payment confirmed: ${new Date(s.paidAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
    ...(s.taxInvoicePending
      ? ["Tax invoice configuration is incomplete. This receipt is not a GST tax invoice."]
      : []),
    ...(doc.kind === "credit_note"
      ? ["Confirmed full refund for this order. Original purchase document remains unchanged."]
      : []),
    "This document records the saved sandbox purchase snapshot. It is not a declaration of tax compliance.",
  ];
}
function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}
export function billingHtml(input: unknown) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Sandbox billing document</title></head><body><main><h1>Sandbox billing document</h1>${billingLines(
    input,
  )
    .map((line) => `<p>${escape(line)}</p>`)
    .join("")}</main></body></html>`;
}
export async function billingPdf(input: unknown) {
  const lines = billingLines(input);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle("Sandbox purchase document");
  pdf.setProducer("Market Method");
  const [latin, devanagari] = await Promise.all([
    readFile(join(process.cwd(), "backend/assets/fonts/NotoSans-Regular.ttf")),
    readFile(join(process.cwd(), "backend/assets/fonts/NotoSansDevanagari-Regular.ttf")),
  ]);
  const fonts = [
    await pdf.embedFont(latin, { subset: true }),
    await pdf.embedFont(devanagari, { subset: true }),
  ];
  const sets = fonts.map((font) => new Set(font.getCharacterSet()));
  let page = pdf.addPage([595, 842]);
  let y = 790;
  let x = 45;
  const newLine = () => {
    x = 45;
    y -= 20;
    if (y < 50) {
      page = pdf.addPage([595, 842]);
      y = 790;
    }
  };
  function draw(text: string, font: PDFFont) {
    const width = font.widthOfTextAtSize(text, 10);
    if (x + width > 550) newLine();
    page.drawText(text, { x, y, size: 10, font, color: rgb(0.08, 0.12, 0.16) });
    x += width;
  }
  for (const line of lines) {
    // Keep Indic word runs together so fontkit can shape their glyphs. Wrap
    // unusually long fields by grapheme without losing the original snapshot.
    for (const token of line.split(/(\s+)/)) {
      const runs = token.match(/[\u0900-\u097f]+|[^\u0900-\u097f]+/gu) ?? [];
      for (const run of runs) {
        const index = /^[\u0900-\u097f]/u.test(run) ? 1 : 0;
        const safe = [...run]
          .map((char) => (sets[index].has(char.codePointAt(0)!) ? char : "?"))
          .join("");
        if (fonts[index].widthOfTextAtSize(safe, 10) > 505) {
          for (const segment of new Intl.Segmenter("hi", { granularity: "grapheme" }).segment(safe))
            draw(segment.segment, fonts[index]);
        } else draw(safe, fonts[index]);
      }
    }
    newLine();
  }
  return pdf.save();
}
