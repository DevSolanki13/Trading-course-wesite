import { NextResponse } from "next/server";
import { identity } from "@/backend/auth/session";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ orderId: string }> }) { try { const context = await identity(); const { orderId } = await params; const { data, error } = await context.admin.from("orders").select("id,status,total_paise,course_snapshot,paid_at,gst_enabled,tax_paise").eq("id", orderId).eq("user_id", context.user.id).single(); if (error || !data) return NextResponse.json({ error: "Order not found." }, { status: 404 }); return NextResponse.json({ order: data }); } catch { return NextResponse.json({ error: "Please sign in to view this order." }, { status: 401 }); } }
