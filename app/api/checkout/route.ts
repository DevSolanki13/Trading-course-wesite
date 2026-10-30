import { NextResponse } from "next/server";
import { identity } from "@/backend/auth/session";
import { getCourse } from "@/frontend/content/courses";
import { createAdminClient } from "@/backend/database/supabase";
import { calculateTotal } from "@/backend/payments/calculations";
import { isDemoPaymentEnabled, paymentProvider } from "@/backend/payments/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!isDemoPaymentEnabled()) return NextResponse.json({ error: "Checkout is not available." }, { status: 404 });
  try {
    const context = await identity();
    const body = await request.json() as { slug?: string; terms?: boolean };
    if (!body.terms) return NextResponse.json({ error: "Please accept the terms to continue." }, { status: 400 });
    const course = body.slug ? getCourse(body.slug) : undefined;
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
    const admin = createAdminClient();
    const { data: existing } = await admin.from("courses").select("id").eq("slug", course.slug).maybeSingle();
    const courseId = existing?.id;
    if (!courseId) return NextResponse.json({ error: "This course is not ready for checkout." }, { status: 409 });
    const { data: owned } = await admin.from("enrollments").select("id").eq("user_id", context.user.id).eq("course_id", courseId).eq("active", true).maybeSingle();
    if (owned) return NextResponse.json({ error: "You already own this course.", code: "ALREADY_OWNED" }, { status: 409 });
    const { data: settings } = await admin.from("site_settings").select("gst_enabled,gst_rate_bps,refund_window_days,refund_watch_limit_percent").eq("id", true).single();
    const totals = calculateTotal({ basePaise: Math.round(course.price * 100), gstEnabled: settings?.gst_enabled ?? false, gstRateBps: settings?.gst_rate_bps ?? 0 });
    const key = `${context.user.id}:${courseId}`;
    const { data: order, error } = await admin.from("orders").insert({ user_id: context.user.id, course_id: courseId, status: "pending", currency: "INR", ...totals, idempotency_key: key, course_snapshot: course, refund_policy_snapshot: { window_days: settings?.refund_window_days ?? 7, watch_limit_percent: settings?.refund_watch_limit_percent ?? 10 } }).select("id").single();
    if (error || !order) return NextResponse.json({ error: error?.code === "23505" ? "A checkout is already in progress." : "Could not start checkout." }, { status: 409 });
    const provider = paymentProvider();
    const created = await provider.createOrder({ id: order.id, amountPaise: totals.totalPaise, currency: "INR", courseSlug: course.slug, customerEmail: context.user.email ?? "" });
    await admin.from("orders").update({ provider_order_id: created.providerOrderId }).eq("id", order.id);
    await admin.from("payment_attempts").insert({ order_id: order.id, provider_payment_id: created.providerOrderId, status: "created", amount_paise: totals.totalPaise });
    return NextResponse.json({ checkoutUrl: created.checkoutUrl, orderId: order.id });
  } catch { return NextResponse.json({ error: "Please sign in before checkout." }, { status: 401 }); }
}
