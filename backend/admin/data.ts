import "server-only";
import type { Identity } from "../auth/session";
import { AuthError } from "../auth/http";
import type { AdminCourse } from "../../shared/admin";
export const courseSelection =
  "*,modules(id,title,position,lessons(id,title,position,duration_seconds,is_preview,published,lesson_assets(provider_video_id,notes,provider_status,verified_at,verified_duration),lesson_resources(id,title,content,position)))";
export function databaseError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "42501")
    throw new AuthError(403, "This role cannot perform that action.", "FORBIDDEN");
  if (error.code === "40001")
    throw new AuthError(409, "This record changed. Reload it before saving.", "STALE_RECORD");
  if (error.code === "23505")
    throw new AuthError(409, "That slug, code or request already exists.");
  if (error.code === "22023" || error.code === "23514")
    throw new AuthError(
      400,
      "The operation could not be applied. Check publishing, access, version or refund eligibility.",
    );
  throw new AuthError(
    503,
    "The operation could not be completed. No partial change was committed.",
  );
}
export async function getCourse(context: Identity, id: string) {
  const r = await context.admin.from("courses").select(courseSelection).eq("id", id).maybeSingle();
  databaseError(r.error);
  if (!r.data) throw new AuthError(404, "Course not found.");
  return r.data as unknown as AdminCourse;
}
export async function orderQuery(context: Identity, url: URL, exporting = false) {
  let q = context.admin
    .from("orders")
    .select(
      "id,user_id,course_id,provider_order_id,status,currency,base_paise,discount_paise,tax_paise,total_paise,course_snapshot,billing_snapshot,created_at,paid_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });
  const status = url.searchParams.get("status");
  if (status && ["pending", "paid", "failed", "cancelled", "refunded"].includes(status))
    q = q.eq("status", status);
  const user = url.searchParams.get("userId");
  if (user && /^[a-f0-9-]{36}$/.test(user)) q = q.eq("user_id", user);
  const course = url.searchParams.get("courseId");
  if (course && /^[a-f0-9-]{36}$/.test(course)) q = q.eq("course_id", course);
  const query = url.searchParams.get("q")?.trim();
  if (query) {
    if (/^[a-f0-9-]{36}$/.test(query)) q = q.eq("id", query);
    else q = q.ilike("provider_order_id", `%${query.replace(/[%_]/g, "").slice(0, 100)}%`);
  }
  for (const [key, op] of [
    ["from", "gte"],
    ["to", "lte"],
  ] as const) {
    const value = url.searchParams.get(key);
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value))
      q = q[op]("created_at", value + (op === "gte" ? "T00:00:00+05:30" : "T23:59:59.999+05:30"));
  }
  const page = Number(url.searchParams.get("page") ?? 0);
  const offset = Number.isInteger(page) && page > 0 ? Math.min(page, 10000) * 50 : 0;
  const result = await q.range(exporting ? 0 : offset, exporting ? 999 : offset + 49);
  databaseError(result.error);
  return { items: result.data ?? [], total: result.count ?? 0 };
}
export async function overview(context: Identity, range: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const today = new Date(`${date}T00:00:00+05:30`);
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const since =
    range === "today"
      ? today.toISOString()
      : range === "week"
        ? new Date(today.getTime() - weekday * 86400000).toISOString()
        : range === "month"
          ? new Date(`${parts.year}-${parts.month}-01T00:00:00+05:30`).toISOString()
          : range === "7"
            ? new Date(Date.now() - 7 * 86400000).toISOString()
            : range === "30"
              ? new Date(Date.now() - 30 * 86400000).toISOString()
              : "1970-01-01T00:00:00Z";
  const result = await context.admin.rpc("admin_overview", {
    p_actor: context.user.id,
    p_session: context.sessionId,
    p_since: since,
  });
  databaseError(result.error);
  return result.data;
}
