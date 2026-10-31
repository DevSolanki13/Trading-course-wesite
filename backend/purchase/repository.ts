import { localDemoEnabled } from "./mode.ts";
import type {
  PurchaseCourse,
  PurchaseOrder,
  PurchaseLessonContent,
} from "../../shared/purchase.ts";
export async function purchaseRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!/^purchase_[a-z_]+$/.test(name) || Object.keys(args).some((key) => !/^p_[a-z_]+$/.test(key)))
    throw new Error("Invalid purchase operation");
  if (localDemoEnabled()) {
    const { localDatabase } = await import("../local/database.ts");
    const db = await localDatabase();
    const keys = Object.keys(args);
    const result = await db.query<{ result: T }>(
      `select public.${name}(${keys.map((key, i) => `${key}=>$${i + 1}`).join(",")})as result`,
      Object.values(args),
    );
    return result.rows[0].result;
  }
  const { createAdminClient } = await import("../database/supabase");
  const result = await createAdminClient().rpc(name, args);
  if (result.error)
    throw Object.assign(
      new Error(
        result.error.code === "23505"
          ? "You already own this course."
          : result.error.code === "42501"
            ? "Purchase to unlock this course."
            : result.error.code === "22023"
              ? "Check your saved order or course configuration before retrying."
              : "Purchase service temporarily unavailable.",
      ),
      { code: result.error.code },
    );
  return result.data as T;
}
export const purchaseCatalog = (userId: string | null = null) =>
  purchaseRpc<PurchaseCourse[]>("purchase_read", {
    p_action: "catalog",
    p_user: userId,
    p_ref: null,
  });
export const purchaseCourse = (ref: string, userId: string | null = null) =>
  purchaseRpc<PurchaseCourse | null>("purchase_read", {
    p_action: "course",
    p_user: userId,
    p_ref: ref,
  });
export const purchaseOrder = (id: string, userId: string) =>
  purchaseRpc<PurchaseOrder | null>("purchase_read", {
    p_action: "order",
    p_user: userId,
    p_ref: id,
  });
export async function purchaseConfirmation(id: string, userId: string) {
  const order = await purchaseOrder(id, userId);
  return {
    order,
    expired: !!order?.accessExpiresAt && Date.parse(order.accessExpiresAt) <= Date.now(),
  };
}
export const purchaseOrders = (userId: string) =>
  purchaseRpc<PurchaseOrder[]>("purchase_read", {
    p_action: "orders",
    p_user: userId,
    p_ref: null,
  });
export const purchaseLesson = (id: string, userId: string | null) =>
  purchaseRpc<PurchaseLessonContent>("purchase_read", {
    p_action: "lesson",
    p_user: userId,
    p_ref: id,
  });
