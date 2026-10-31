import { z } from "zod";
import { admitted } from "@/backend/auth/session";
import { AuthError, failure, limit } from "@/backend/auth/http";
import { billingHtml, billingPdf } from "@/backend/billing/document";
import { canReadBilling, type SavedBillingDocument } from "@/backend/billing/access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const context = await admitted();
    await limit(request, "billing-download", context.user.id, 30, 60);
    const { orderId } = await params;
    if (!z.string().uuid().safeParse(orderId).success)
      throw new AuthError(404, "Document not found.");
    const url = new URL(request.url);
    const credit = url.searchParams.get("kind") === "credit_note";
    const order = await context.admin
      .from("orders")
      .select("id,user_id,status")
      .eq("id", orderId)
      .eq("user_id", context.user.id)
      .maybeSingle();
    if (order.error) throw new AuthError(503, "Order information is unavailable.");
    if (!order.data) throw new AuthError(404, "Document not found.");
    const result = await context.admin
      .from("billing_documents")
      .select("order_id,user_id,kind,number,snapshot,issued_at")
      .eq("order_id", orderId)
      .eq("user_id", context.user.id)
      .in("kind", credit ? ["credit_note"] : ["receipt", "invoice"])
      .maybeSingle();
    if (result.error) throw new AuthError(503, "Billing documents are temporarily unavailable.");
    const doc = result.data as SavedBillingDocument | null;
    if (!canReadBilling(context.user.id, order.data, doc) || !doc)
      throw new AuthError(404, "This billing document is not available yet.");
    const html = url.searchParams.get("format") === "html";
    const headers = {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": html ? "text/html; charset=utf-8" : "application/pdf",
      "Content-Disposition": `attachment; filename="${doc.number.replace(/[^A-Z0-9-]/gi, "")}.${html ? "html" : "pdf"}"`,
    };
    return new Response(html ? billingHtml(doc) : new Uint8Array(await billingPdf(doc)), {
      headers,
    });
  } catch (error) {
    return failure(error);
  }
}
