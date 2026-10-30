import { NextResponse } from "next/server";
import { createAdminClient } from "@/backend/database/supabase";
import { DemoProvider, isDemoPaymentEnabled } from "@/backend/payments/demo";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isDemoPaymentEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const raw = await request.text();
  try {
    const event = new DemoProvider().verifyWebhook(raw, request.headers);
    const admin = createAdminClient();
    const { data: order } = await admin.from("orders").select("id,user_id,course_id,total_paise,status").eq("provider_order_id", event.providerOrderId).single();
    if (!order || order.total_paise !== event.amountPaise) throw new Error("Order mismatch");
    const { error: inboxError } = await admin.from("webhook_events").insert({ provider: "demo", payload_hash: event.eventId, payload: event, status: "received" });
    if (inboxError?.code === "23505") return NextResponse.json({ received: true });
    if (inboxError) throw inboxError;
    const status = event.status === "paid" ? "paid" : event.status === "failed" ? "failed" : event.status === "cancelled" ? "cancelled" : "pending";
    const update = await admin.from("orders").update({ status, paid_at: status === "paid" ? new Date().toISOString() : null }).eq("id", order.id).eq("status", "pending");
    if (update.error) throw update.error;
    if (status === "paid") { const enrollment = await admin.from("enrollments").insert({ user_id: order.user_id, course_id: order.course_id, order_id: order.id, source: "purchase", active: true }); if (enrollment.error && enrollment.error.code !== "23505") throw enrollment.error; }
    await admin.from("webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("payload_hash", event.eventId).eq("provider", "demo");
    return NextResponse.json({ received: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid payment event." }, { status: 400 }); }
}
