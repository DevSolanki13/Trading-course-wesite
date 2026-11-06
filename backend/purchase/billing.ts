import "server-only";
import { createAdminClient } from "../database/supabase";
import type { PurchaseOrder } from "../../shared/purchase";

type CommerceOrderRow = {
  id: string;
  user_id: string;
  course_id: string;
  provider_order_id: string | null;
  status: string;
  currency: "INR";
  base_paise: number;
  tax_paise: number;
  total_paise: number;
  course_snapshot: {
    slug?: string;
    title?: string;
    access_period?: number;
    access_unit?: "days" | "months";
  };
  created_at: string;
  paid_at: string | null;
  enrollments: { expires_at: string }[] | { expires_at: string } | null;
};

/** Cashfree/demo orders predate purchase_provider and are excluded by purchase_read. */
export async function commerceOrders(userId: string, orderId?: string): Promise<PurchaseOrder[]> {
  let query = createAdminClient()
    .from("orders")
    .select(
      "id,user_id,course_id,provider_order_id,status,currency,base_paise,tax_paise,total_paise,course_snapshot,created_at,paid_at,enrollments(expires_at)",
    )
    .eq("user_id", userId)
    .is("purchase_provider", null);
  if (orderId) query = query.eq("id", orderId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error("Billing history is temporarily unavailable.");
  return ((data ?? []) as unknown as CommerceOrderRow[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    slug: row.course_snapshot?.slug ?? "",
    courseTitle: row.course_snapshot?.title ?? "Course purchase",
    amount: row.total_paise,
    base: row.base_paise,
    tax: row.tax_paise,
    currency: row.currency,
    status: row.status,
    provider: row.provider_order_id?.startsWith("cf_sbx_") ? "cashfree" : "demo",
    providerOrderId: row.provider_order_id,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    accessPeriod: row.course_snapshot?.access_period ?? 1,
    accessUnit: row.course_snapshot?.access_unit ?? "months",
    accessExpiresAt:
      (Array.isArray(row.enrollments)
        ? row.enrollments[0]?.expires_at
        : row.enrollments?.expires_at) ?? null,
  }));
}
