import { localDemoEnabled } from "./mode.ts";
import type {
  PurchaseCourse,
  PurchaseOrder,
  PurchaseLessonContent,
  PurchaseOrdersPage,
  PurchaseHistoryCursor,
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
export const purchaseQuoteCoupon = (course: string, code: string, userId: string) =>
  purchaseRpc<{ base: number; discount: number; total: number }>("purchase_quote_coupon", {
    p_user: userId,
    p_course: course,
    p_code: code,
  });
export async function purchaseOrder(id: string, userId: string) {
  const order = await purchaseRpc<PurchaseOrder | null>("purchase_read", {
    p_action: "order",
    p_user: userId,
    p_ref: id,
  });
  if (order || localDemoEnabled()) return order;
  const { commerceOrders } = await import("./billing");
  return (await commerceOrders(userId, id))[0] ?? null;
}
export async function purchaseConfirmation(id: string, userId: string) {
  const order = await purchaseOrder(id, userId);
  return {
    order,
    expired: !!order?.accessExpiresAt && Date.parse(order.accessExpiresAt) <= Date.now(),
  };
}
export async function purchaseOrders(userId: string) {
  const legacy = () =>
    purchaseRpc<PurchaseOrder[]>("purchase_read", {
      p_action: "orders",
      p_user: userId,
      p_ref: null,
    });
  if (localDemoEnabled()) return legacy();
  const [orders, current] = await Promise.all([
    legacy(),
    import("./billing").then(({ commerceOrders }) => commerceOrders(userId)),
  ]);
  return [...orders, ...current].sort(
    (a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
  );
}

/** Versioned bounded history across every provider. Cursors retain Postgres timestamp precision. */
export function purchaseOrdersPage(
  userId: string,
  options: {
    limit?: number;
    cursor?: PurchaseHistoryCursor | null;
    status?: string;
    provider?: string;
    pendingCursor?: PurchaseHistoryCursor | null;
    pendingOnly?: boolean;
  } = {},
): Promise<PurchaseOrdersPage> {
  return purchaseRpc<PurchaseOrdersPage>("purchase_history_page", {
    p_user: userId,
    p_limit: options.limit ?? 20,
    p_cursor: options.cursor ?? null,
    p_status: options.status ?? "all",
    p_provider: options.provider ?? "all",
    p_pending_cursor: options.pendingCursor ?? null,
    p_pending_only: options.pendingOnly ?? false,
  });
}

/** Only used after admission, with the verified user's ID; never transfers order details. */
export async function purchaseOrderCount(userId: string): Promise<number> {
  if (localDemoEnabled()) {
    const { localDatabase } = await import("../local/database.ts");
    const result = await (
      await localDatabase()
    ).query<{ count: number }>(
      "select count(*)::integer as count from public.orders where user_id=$1",
      [userId],
    );
    return result.rows[0].count;
  }
  const { createAdminClient } = await import("../database/supabase");
  const { count, error } = await createAdminClient()
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error || count === null) throw new Error("Billing summary is temporarily unavailable.");
  return count;
}
export const purchaseLesson = async (id: string, userId: string | null) => {
  const content = await purchaseRpc<PurchaseLessonContent>("purchase_read", {
    p_action: "lesson",
    p_user: userId,
    p_ref: id,
  });
  if (localDemoEnabled()) {
    try {
      const { localDatabase } = await import("../local/database.ts");
      const db = await localDatabase();
      const asset = (
        await db.query<{ provider_video_id: string | null }>(
          "select provider_video_id from lesson_assets where lesson_id = $1",
          [id],
        )
      ).rows[0];
      if (asset?.provider_video_id) {
        content.providerVideoId = asset.provider_video_id;
        let secret = process.env.VDOCIPHER_API_SECRET;
        if (!secret) {
          const { existsSync, readFileSync } = await import("node:fs");
          if (existsSync(".env.local")) {
            const raw = readFileSync(".env.local", "utf8");
            const match = raw.match(/VDOCIPHER_API_SECRET=(.+)/);
            if (match) secret = match[1].trim().replace(/^['"]|['"]$/g, "");
          }
        }
        if (secret) {
          const res = await fetch(
            `https://dev.vdocipher.com/api/videos/${encodeURIComponent(asset.provider_video_id)}/otp`,
            {
              method: "POST",
              headers: {
                Authorization: `Apisecret ${secret}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ttl: 300,
                annotate: JSON.stringify([
                  {
                    type: "rtext",
                    text: "indianXtrade Student",
                    alpha: "0.6",
                    color: "0xFFFFFF",
                    size: "15",
                    interval: "5000",
                    skip: "2000",
                  },
                ]),
              }),
              signal: AbortSignal.timeout(10000),
            },
          );
          if (res.ok) {
            const data = (await res.json()) as { otp?: string; playbackInfo?: string };
            if (data.otp && data.playbackInfo) {
              content.vdoCipher = {
                otp: data.otp,
                playbackInfo: data.playbackInfo,
              };
            }
          }
        }
      }
    } catch {
      // Continue with existing content if provider lookup fails
    }
  }
  return content;
};
