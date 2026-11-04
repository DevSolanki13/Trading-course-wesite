import type { PGlite } from "@electric-sql/pglite";
import { pageNumber } from "../admin/policy.ts";

/** Read only from the same database used by local student accounts and purchases. */
export async function localAdminRead(
  db: PGlite,
  action: string,
  url: URL,
  role = "admin",
): Promise<Record<string, unknown> | null | undefined> {
  const page = pageNumber(url.searchParams.get("page"));
  if (action === "students") {
    const query = `%${(url.searchParams.get("q") ?? "").replace(/[%_]/g, "").slice(0, 120)}%`;
    const where = `from profiles p join auth.users u on u.id=p.id where ${role === "support" ? "p.role='student' and " : ""}(p.full_name ilike $1 or u.email ilike $1 or p.id::text=$3)`;
    const search = url.searchParams.get("q") ?? "";
    const items = await db.query<Record<string, unknown>>(
      `select p.id,p.full_name,p.phone,p.role,p.blocked,p.created_at,u.email ${where} order by p.created_at desc,p.id limit 50 offset $2`,
      [query, page * 50, search],
    );
    // Deduplicate so students never repeat
    const seen = new Set<string>();
    const deduped = items.rows.filter((it) => {
      const key = String(it.email || it.id || "")
        .toLowerCase()
        .trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Attach active device counts
    for (const it of deduped) {
      try {
        const dCount = await db.query<{ count: number }>(
          `select count(*)::integer as count from device_sessions where user_id=$1 and admitted_at is not null and revoked_at is null and expires_at > now()`,
          [it.id],
        );
        it.active_devices = dCount.rows[0]?.count ?? 0;
      } catch {
        it.active_devices = 0;
      }
    }

    const total = await db.query<{ total: number }>(
      `select count(*)::integer as total ${where.replace("$3", "$2")}`,
      [query, search],
    );
    return { items: deduped, total: total.rows[0]?.total ?? deduped.length };
  }
  if (action === "orders" || action === "export") {
    const values: string[] = [];
    const conditions: string[] = [];
    const add = (sql: string, value: string) => {
      values.push(value);
      conditions.push(sql.replace("?", `$${values.length}`));
    };
    const status = url.searchParams.get("status");
    if (status && ["pending", "paid", "failed", "cancelled", "refunded"].includes(status))
      add("status=?", status);
    for (const [key, column] of [
      ["userId", "user_id"],
      ["courseId", "course_id"],
    ]) {
      const value = url.searchParams.get(key);
      if (value && /^[a-f0-9-]{36}$/i.test(value)) add(`${column}::text=?`, value);
    }
    const query = url.searchParams.get("q")?.trim();
    if (query) {
      if (/^[a-f0-9-]{36}$/i.test(query)) add("id::text=?", query);
      else add("provider_order_id ilike ?", `%${query.replace(/[%_]/g, "").slice(0, 100)}%`);
    }
    for (const [key, op, time] of [
      ["from", ">=", "T00:00:00+05:30"],
      ["to", "<=", "T23:59:59.999+05:30"],
    ]) {
      const value = url.searchParams.get(key);
      if (value && /^\d{4}-\d{2}-\d{2}$/.test(value))
        add(`created_at${op}?::timestamptz`, value + time);
    }
    const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
    const total = await db.query<{ total: number }>(
      `select count(*)::integer as total from orders ${where}`,
      values,
    );
    const items = await db.query(
      `select * from orders ${where} order by created_at desc,id limit ${action === "export" ? 1000 : 50} offset ${action === "export" ? 0 : page * 50}`,
      values,
    );
    return { items: items.rows, total: total.rows[0].total };
  }
  if (action === "order-filters")
    return {
      courses: (
        await db.query(
          "select id,title from courses where status in ('published','archived') order by title limit 200",
        )
      ).rows,
    };
  if (action === "refunds") {
    const state = url.searchParams.get("state");
    const filter =
      state &&
      ["requested", "approved", "processing", "failed", "rejected", "refunded"].includes(state)
        ? state
        : null;
    const items = await db.query(
      "select r.*,public.refund_evidence(r.order_id) as current_evidence from refund_requests r where ($1::text is null or state=$1) order by created_at desc,id limit 50 offset $2",
      [filter, page * 50],
    );
    const total = await db.query<{ total: number }>(
      "select count(*)::integer as total from refund_requests where ($1::text is null or state=$1)",
      [filter],
    );
    return { items: items.rows, total: total.rows[0].total, providerActionsAvailable: false };
  }
  if (action === "student") {
    const id = url.searchParams.get("id") ?? "";
    const profile = (
      await db.query<Record<string, unknown>>(
        "select p.id,p.full_name,p.phone,p.role,p.blocked,p.created_at,u.email from profiles p join auth.users u on u.id=p.id where p.id::text=$1 and ($2='admin' or p.role='student')",
        [id, role],
      )
    ).rows[0];
    if (!profile) return null;
    const [enrollments, orders, progress, courses] = await Promise.all([
      db.query(
        "select id,course_id,source,active,revoked_at,order_id from enrollments where user_id::text=$1",
        [id],
      ),
      db.query(
        "select id,course_id,status,total_paise,created_at from orders where user_id::text=$1 order by created_at desc limit 50",
        [id],
      ),
      db.query(
        "select lp.lesson_id,lp.position_ms,l.duration_seconds,lp.completed,coalesce((select sum(upper(r)-lower(r))/1000.0 from unnest(lp.watched) r),0) as watched_seconds from lesson_progress lp join lessons l on l.id=lp.lesson_id where lp.user_id::text=$1",
        [id],
      ),
      db.query("select id,title,status from courses where status='published'"),
    ]);
    return {
      profile,
      enrollments: enrollments.rows,
      orders: orders.rows,
      progress: progress.rows,
      devices: [],
      courses: courses.rows,
    };
  }
  if (action === "order") {
    const id = url.searchParams.get("id") ?? "";
    const order = (
      await db.query<Record<string, unknown>>("select * from orders where id::text=$1", [id])
    ).rows[0];
    if (!order) return null;
    const payments = await db.query(
      "select id,provider_payment_id,status,amount_paise from payment_attempts where order_id::text=$1",
      [id],
    );
    const evidence = await db.query<{ evidence: unknown }>(
      "select public.refund_evidence($1::uuid) as evidence",
      [id],
    );
    return {
      order,
      payments: payments.rows,
      evidence: evidence.rows[0].evidence,
      providerActionsAvailable: false,
    };
  }
  if (action === "settings")
    return (await db.query<Record<string, unknown>>("select * from site_settings where id=true"))
      .rows[0];
  if (action === "content")
    return (
      await db.query<Record<string, unknown>>(
        "select document,version from site_content where id=true",
      )
    ).rows[0];
  if (action === "coupons")
    return {
      items: (
        await db.query(
          "select c.*,coalesce((select jsonb_agg(jsonb_build_object('state',r.state)) from coupon_redemptions r where r.coupon_id=c.id),'[]'::jsonb) as coupon_redemptions from coupons c order by created_at desc limit 200",
        )
      ).rows,
    };
  if (action === "audit")
    return {
      items: (
        await db.query(
          "select id,actor_id,action,target_type,target_id,details,created_at from audit_log order by id desc limit 50 offset $1",
          [page * 50],
        )
      ).rows,
    };
  if (action === "notifications")
    return {
      items: (
        await db.query(
          "select id,state,attempts,subject,created_at,next_attempt_at from notification_outbox order by created_at desc limit 100",
        )
      ).rows,
    };
  if (action === "tasks")
    return {
      items: (
        await db.query(
          "select t.*,exists(select 1 from enrollments e join orders o on o.id=e.order_id and o.user_id=e.user_id and o.course_id=e.course_id where e.user_id=t.user_id and e.source='purchase' and e.active and e.revoked_at is null and (e.expires_at is null or e.expires_at>now()) and o.status='paid') as \"qualifyingPaidAccessNow\" from operations_tasks t order by created_at desc limit 100",
        )
      ).rows,
    };
  return undefined;
}
