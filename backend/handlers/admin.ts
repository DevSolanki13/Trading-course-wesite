import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { privileged, audit } from "../auth/session";
import { AuthError, body, failure, json, limit, sameOrigin } from "../auth/http";
import { operationSchemas, type AdminAction } from "../admin/validation";
import { databaseError, getCourse, orderQuery, overview } from "../admin/data";
import { pageNumber, csvRows } from "../admin/policy";
import { videoStatus, videoUpload } from "../admin/video";
import { requireEnv } from "../config/env";
import { CashfreeClient, cashfreeSandboxEnabled } from "../payments/cashfree";
import { commerceStore } from "../payments/data";
import { reconcilePayment, reconcileRefund } from "../payments/workflow";
import { cookies } from "next/headers";
import { localDemoEnabled } from "../purchase/mode";
import { LOCAL_SESSION_COOKIE, localSession } from "../local/auth";
import { localCourseLearners } from "../admin/data";
import { localDatabase } from "../local/database";
import { localAdminRead } from "../local/admin";

async function localCourse(db: Awaited<ReturnType<typeof localDatabase>>, id: string) {
  const course = (
    await db.query<Record<string, unknown> & { version: number }>(
      "select id,slug,title,description,level,language,status,price_paise,sale_price_paise,access_period,access_unit,thumbnail_url,outcomes,audience,prerequisites,artwork,version,updated_at from courses where id=$1",
      [id],
    )
  ).rows[0];
  if (!course) throw new AuthError(404, "Course not found.");
  const modules = await db.query<{ id: string; title: string; position: number }>(
    "select id,title,position from modules where course_id=$1 order by position",
    [id],
  );
  const result = [];
  for (const moduleRow of modules.rows) {
    const lessons = await db.query<
      Record<string, unknown> & { id: string; lesson_assets: Record<string, unknown> | null }
    >(
      `select l.id,l.title,l.position,l.duration_seconds,l.is_preview,l.published,
        jsonb_build_object('provider_video_id',a.provider_video_id,'notes',a.notes,
          'provider_status',a.provider_status,'verified_at',a.verified_at,
          'verified_duration',a.verified_duration) as lesson_assets
       from lessons l left join lesson_assets a on a.lesson_id=l.id
       where l.module_id=$1 order by l.position`,
      [moduleRow.id],
    );
    const lessonRows = [];
    for (const lesson of lessons.rows) {
      const resources = await db.query(
        "select id,title,content,position from lesson_resources where lesson_id=$1 order by position",
        [lesson.id],
      );
      lessonRows.push({
        ...lesson,
        lesson_assets: lesson.lesson_assets?.provider_video_id ? lesson.lesson_assets : null,
        lesson_resources: resources.rows,
      });
    }
    result.push({ ...moduleRow, lessons: lessonRows });
  }
  return { ...course, modules: result };
}

async function localAdminOperation(
  db: Pick<Awaited<ReturnType<typeof localDatabase>>, "query">,
  action: string,
  data: Record<string, unknown>,
) {
  if (action === "course_save") {
    const id = String(data.courseId ?? randomUUID());
    if (data.courseId) {
      const current = await db.query<{ version: number }>(
        "select version from courses where id=$1",
        [id],
      );
      if (!current.rows[0] || current.rows[0].version !== data.version)
        throw new AuthError(409, "Reload this course before saving.", "STALE_RECORD");
      await db.query(
        `update courses set slug=$2,title=$3,description=$4,price_paise=$5,sale_price_paise=$6,
          access_period=$7,access_unit=$8,level=$9,language=$10,thumbnail_url=$11,
          outcomes=$12,audience=$13,prerequisites=$14,artwork=$15,version=version+1,updated_at=now()
         where id=$1`,
        [
          id,
          data.slug,
          data.title,
          data.description,
          data.price_paise,
          data.sale_price_paise,
          data.access_period,
          data.access_unit,
          data.level,
          data.language,
          data.thumbnail_url || null,
          JSON.stringify(data.outcomes),
          data.audience,
          data.prerequisites,
          data.artwork,
        ],
      );
    } else {
      await db.query(
        `insert into courses(id,slug,title,description,price_paise,sale_price_paise,access_period,
          access_unit,level,language,thumbnail_url,outcomes,audience,prerequisites,artwork)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          id,
          data.slug,
          data.title,
          data.description,
          data.price_paise,
          data.sale_price_paise,
          data.access_period,
          data.access_unit,
          data.level,
          data.language,
          data.thumbnail_url || null,
          JSON.stringify(data.outcomes),
          data.audience,
          data.prerequisites,
          data.artwork,
        ],
      );
    }
    return { id };
  }
  if (action === "module_save") {
    const id = String(data.id ?? randomUUID());
    if (data.id) {
      await db.query("update modules set title=$2 where id=$1 and course_id=$3", [
        id,
        data.title,
        data.courseId,
      ]);
    } else {
      const position = await db.query<{ position: number }>(
        "select coalesce(max(position)+1,0)::integer as position from modules where course_id=$1",
        [data.courseId],
      );
      await db.query("insert into modules(id,course_id,title,position)values($1,$2,$3,$4)", [
        id,
        data.courseId,
        data.title,
        position.rows[0].position,
      ]);
    }
    await db.query("update courses set version=version+1,updated_at=now() where id=$1", [
      data.courseId,
    ]);
    return { id };
  }
  if (action === "lesson_save") {
    const id = String(data.id ?? randomUUID());
    const position = data.id
      ? null
      : (
          await db.query<{ position: number }>(
            "select coalesce(max(position)+1,0)::integer as position from lessons where module_id=$1",
            [data.moduleId],
          )
        ).rows[0].position;
    if (data.id) {
      await db.query(
        "update lessons set title=$2,duration_seconds=$3,is_preview=$4,published=$5 where id=$1 and module_id=$6",
        [id, data.title, data.duration_seconds, data.is_preview, data.published, data.moduleId],
      );
    } else {
      await db.query(
        "insert into lessons(id,module_id,title,position,duration_seconds,is_preview,published)values($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          data.moduleId,
          data.title,
          position,
          data.duration_seconds,
          data.is_preview,
          data.published,
        ],
      );
    }
    await db.query("delete from lesson_assets where lesson_id=$1", [id]);
    if (data.videoId) {
      await db.query(
        `insert into lesson_assets(lesson_id,provider_video_id,notes,provider_status,verified_at,verified_duration)
         values($1,$2,$3,'ready',now(),$4)`,
        [id, data.videoId, data.notes, data.duration_seconds],
      );
    }
    await db.query("delete from lesson_resources where lesson_id=$1", [id]);
    for (const [index, resource] of (
      data.resources as { title: string; content: string }[]
    ).entries())
      await db.query(
        "insert into lesson_resources(lesson_id,title,content,position)values($1,$2,$3,$4)",
        [id, resource.title, resource.content, index],
      );
    await db.query("update courses set version=version+1,updated_at=now() where id=$1", [
      data.courseId,
    ]);
    return { id };
  }
  if (action === "course_state") {
    if (data.status === "published") {
      const lessons = await db.query(
        `select l.id from lessons l join modules m on m.id=l.module_id
         join lesson_assets a on a.lesson_id=l.id
         where m.course_id=$1 and l.published and a.provider_status='ready'`,
        [data.courseId],
      );
      if (!lessons.rows.length)
        throw new AuthError(400, "Publish at least one verified lesson first.");
    }
    await db.query("update courses set status=$2,version=version+1,updated_at=now() where id=$1", [
      data.courseId,
      data.status,
    ]);
    return { courseId: data.courseId };
  }
  if (action === "lesson_delete") {
    const lesson = await db.query(
      "select l.id from lessons l join modules m on m.id=l.module_id where l.id=$1 and m.id=$2 and m.course_id=$3",
      [data.lessonId, data.moduleId, data.courseId],
    );
    if (!lesson.rows.length) throw new AuthError(404, "Lesson not found.");
    const used = await db.query<{ used: boolean }>(
      "select exists(select 1 from lesson_progress where lesson_id=$1) or exists(select 1 from order_watch_ranges where lesson_id=$1) as used",
      [data.lessonId],
    );
    if (used.rows[0].used)
      throw new AuthError(
        409,
        "This lesson has learner history and cannot be deleted. Archive the course instead.",
      );
    await db.query("delete from lesson_resources where lesson_id=$1", [data.lessonId]);
    await db.query("delete from lesson_assets where lesson_id=$1", [data.lessonId]);
    await db.query("delete from lessons where id=$1", [data.lessonId]);
    await db.query("update courses set version=version+1,updated_at=now() where id=$1", [
      data.courseId,
    ]);
    return { courseId: data.courseId };
  }
  if (action === "course_delete") {
    const course = await db.query<{ id: string; status: string }>(
      "select id,status from courses where id=$1 and version=$2",
      [data.courseId, data.version],
    );
    if (!course.rows.length) throw new AuthError(404, "Course not found or changed.");
    const used = await db.query<{ used: boolean }>(
      "select exists(select 1 from orders where course_id=$1) or exists(select 1 from enrollments where course_id=$1) as used",
      [data.courseId],
    );
    if (used.rows[0].used)
      throw new AuthError(
        409,
        "This course has order or learner history and cannot be deleted. Archive it instead.",
      );
    await db.query(
      "delete from lesson_resources where lesson_id in (select l.id from lessons l join modules m on m.id=l.module_id where m.course_id=$1)",
      [data.courseId],
    );
    await db.query(
      "delete from lesson_assets where lesson_id in (select l.id from lessons l join modules m on m.id=l.module_id where m.course_id=$1)",
      [data.courseId],
    );
    await db.query(
      "delete from lessons where module_id in (select id from modules where course_id=$1)",
      [data.courseId],
    );
    await db.query("delete from modules where course_id=$1", [data.courseId]);
    await db.query("delete from courses where id=$1", [data.courseId]);
    return { deletedCourseId: data.courseId };
  }
  throw new AuthError(400, "This operation is not available in the local demo.");
}
const uuid = z.string().uuid();
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AuthError(400, result.error.issues[0]?.message ?? "Check the fields.");
  return result.data;
}
export async function adminRequest(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.pathname.replace(/^\/api\/admin\//, "");
    if (request.method !== "GET") sameOrigin(request);
    if (localDemoEnabled()) {
      const localUser = await localSession((await cookies()).get(LOCAL_SESSION_COOKIE)?.value);
      if (!localUser) throw new AuthError(401, "Please sign in to continue.", "SIGN_IN_REQUIRED");
      if (localUser.role !== "admin" && localUser.role !== "support")
        throw new AuthError(403, "This role cannot access the admin workspace.", "FORBIDDEN");
      if (
        localUser.role !== "admin" &&
        ![
          "overview",
          "orders",
          "order-filters",
          "order",
          "students",
          "student",
          "refunds",
          "course-learners",
        ].includes(action)
      )
        throw new AuthError(403, "This action requires an administrator.", "FORBIDDEN");
      if (request.method === "GET") {
        const result = await localAdminRead(await localDatabase(), action, url, localUser.role);
        if (result === null) throw new AuthError(404, "Admin record not found.");
        if (result !== undefined) {
          if (action === "export" && "items" in result && "total" in result) {
            const rows = result.items as Record<string, unknown>[];
            return new Response(
              csvRows([
                [
                  "Order",
                  "Student ID",
                  "Course",
                  "Status",
                  "Total INR",
                  "GST INR",
                  "Provider order",
                  "Created",
                ],
                ...rows.map((o) => [
                  o.id,
                  o.user_id,
                  (o.course_snapshot as { title?: string })?.title ?? o.course_id,
                  o.status,
                  (Number(o.total_paise) / 100).toFixed(2),
                  (Number(o.tax_paise) / 100).toFixed(2),
                  o.provider_order_id,
                  o.created_at,
                ]),
              ]),
              {
                headers: {
                  "Content-Type": "text/csv; charset=utf-8",
                  "Content-Disposition": "attachment; filename=orders.csv",
                  "Cache-Control": "private, no-store",
                  "X-Export-Limit": "1000",
                  "X-Export-Truncated": String(Number(result.total) > rows.length),
                },
              },
            );
          }
          return json(result);
        }
      }
      if (request.method === "GET" && action === "course-learners") {
        const id = parse(uuid, url.searchParams.get("courseId"));
        return json(await localCourseLearners(id));
      }
      if (request.method === "GET" && action === "courses") {
        const db = await localDatabase();
        const courses = await db.query(
          "select id,title,slug,status,price_paise,sale_price_paise,access_period,access_unit,created_at,updated_at,coalesce(version, 1) as version from courses order by updated_at desc limit 200",
        );
        return json({ items: courses.rows });
      }
      if (request.method === "GET" && action === "overview") {
        const db = await localDatabase();
        const [courses, enrolledStudents, revenue, coursePerformance] = await Promise.all([
          db.query<{ count: number }>("select count(*)::integer as count from courses"),
          db.query<{ count: number }>(
            "select count(distinct e.user_id)::integer as count from enrollments e join orders o on o.id=e.order_id where e.source='purchase' and e.active and e.revoked_at is null and o.status='paid' and o.user_id=e.user_id and o.course_id=e.course_id and (e.expires_at is null or e.expires_at>now())",
          ),
          db.query<{ gross: number; refunded: number; sales: number }>(
            "select coalesce(sum(total_paise) filter(where status in ('paid','refunded')),0)::integer as gross, coalesce(sum(total_paise) filter(where status='refunded'),0)::integer as refunded, count(*) filter(where status in ('paid','refunded'))::integer as sales from orders",
          ),
          db.query<{ title: string; sales: number; gross: number; net: number }>(
            "select coalesce(max(course_snapshot->>'title'),c.title) as title,count(*)::integer as sales,coalesce(sum(o.total_paise),0)::integer as gross,coalesce(sum(o.total_paise) filter(where o.status='paid'),0)::integer as net from orders o join courses c on c.id=o.course_id where o.status in ('paid','refunded') group by o.course_id,c.title order by gross desc",
          ),
        ]);
        const gross = revenue.rows[0]?.gross ?? 0;
        const refunded = revenue.rows[0]?.refunded ?? 0;
        return json({
          gross,
          refunded,
          net: gross - refunded,
          sales: revenue.rows[0]?.sales ?? 0,
          refundRate: 0,
          newStudents: 0,
          coursesCount: courses.rows[0]?.count ?? 0,
          enrolledStudents: enrolledStudents.rows[0]?.count ?? 0,
          pendingRefunds: 0,
          chart: [],
          courses: coursePerformance.rows,
          limited: false,
        });
      }
      if (request.method === "GET" && action === "course") {
        const id = parse(uuid, url.searchParams.get("id"));
        return json({ course: await localCourse(await localDatabase(), id) });
      }
      if (request.method === "GET" && action === "video-test")
        return json({ videoId: "local-demo-video-1", status: "ready", duration: 60 });
      if (request.method === "POST" && action === "video-status") {
        const input = parse(
          z.object({ videoId: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/) }).strict(),
          await body(request),
        );
        return json({ videoId: input.videoId, status: "ready", duration: 60 });
      }
      if (request.method === "POST" && action === "operations") {
        const envelope = parse(
          z
            .object({
              action: z.enum([
                "course_save",
                "module_save",
                "lesson_save",
                "course_state",
                "course_delete",
                "lesson_delete",
              ]),
              data: z.unknown(),
            })
            .strict(),
          await body(request, 65536),
        );
        const data = parse(
          operationSchemas[envelope.action] as z.ZodType<Record<string, unknown>>,
          envelope.data,
        );
        if (envelope.action === "course_delete" || envelope.action === "lesson_delete") {
          const result = await (
            await localDatabase()
          ).transaction((tx) => localAdminOperation(tx, envelope.action, data));
          return json({ message: "Deleted successfully.", ...result });
        }
        const result = await (
          await localDatabase()
        ).transaction((tx) => localAdminOperation(tx, envelope.action, data));
        return json({ message: "Saved successfully.", ...result });
      }
      // Never fall through into Supabase: the demo launcher disables its credentials.
      throw new AuthError(
        404,
        "This admin action is not available in the local demo.",
        "LOCAL_ACTION_UNAVAILABLE",
      );
    }
    const adminOnly = ![
      "overview",
      "orders",
      "order-filters",
      "order",
      "students",
      "student",
      "refunds",
      "operations",
    ].includes(action);
    const context = await privileged(adminOnly);
    if (request.method === "GET") {
      if (action === "video-test") {
        const videoId = requireEnv("VDOCIPHER_TEST_VIDEO_ID");
        return json({ videoId, ...(await videoStatus(videoId)) });
      }
      if (action === "overview")
        return json(await overview(context, url.searchParams.get("range") ?? "30"));
      if (action === "courses") {
        const r = await context.admin
          .from("courses")
          .select(
            "id,title,slug,status,price_paise,sale_price_paise,access_period,access_unit,created_at,updated_at,version",
          )
          .order("updated_at", { ascending: false })
          .limit(200);
        databaseError(r.error);
        return json({ items: r.data });
      }
      if (action === "course")
        return json({ course: await getCourse(context, parse(uuid, url.searchParams.get("id"))) });
      if (action === "course-learners") {
        const id = parse(uuid, url.searchParams.get("courseId"));
        const result = await context.admin.rpc("admin_course_learners", {
          p_actor: context.user.id,
          p_session: context.sessionId,
          p_course: id,
        });
        databaseError(result.error);
        return json(result.data);
      }
      if (action === "students") {
        const r = await context.admin.rpc("admin_students", {
          p_actor: context.user.id,
          p_session: context.sessionId,
          p_query: (url.searchParams.get("q") ?? "").replace(/[%_]/g, "").slice(0, 120),
          p_page: pageNumber(url.searchParams.get("page")),
        });
        databaseError(r.error);
        return json(r.data);
      }
      if (action === "student") {
        const id = parse(uuid, url.searchParams.get("id"));
        const p = await context.admin
          .from("profiles")
          .select("id,full_name,phone,role,blocked,created_at")
          .eq("id", id)
          .single();
        databaseError(p.error);
        if (context.profile.role === "support" && p.data?.role !== "student")
          throw new AuthError(403, "Support can inspect student accounts only.");
        const [user, enrollments, orders, progress, devices, courses] = await Promise.all([
          context.admin.auth.admin.getUserById(id),
          context.admin
            .from("enrollments")
            .select("id,course_id,source,active,revoked_at,order_id")
            .eq("user_id", id),
          context.admin
            .from("orders")
            .select("id,course_id,status,total_paise,created_at")
            .eq("user_id", id)
            .order("created_at", { ascending: false })
            .limit(50),
          context.admin.rpc("learning_progress", { p_user: id }),
          context.admin.rpc("auth_list_devices", { p_user: id }),
          context.admin.from("courses").select("id,title,status").eq("status", "published"),
        ]);
        for (const r of [enrollments, orders, progress, devices, courses]) databaseError(r.error);
        if (user.error) throw new AuthError(503, "Student identity is unavailable.");
        return json({
          profile: { ...p.data, email: user.data.user.email },
          enrollments: enrollments.data,
          orders: orders.data,
          progress: progress.data,
          devices: devices.data,
          courses: courses.data,
        });
      }
      if (action === "orders") return json(await orderQuery(context, url));
      if (action === "order-filters") {
        const rows = await context.admin
          .from("courses")
          .select("id,title")
          .in("status", ["published", "archived"])
          .order("title")
          .limit(200);
        databaseError(rows.error);
        return json({ courses: rows.data });
      }
      if (action === "order") {
        const id = parse(uuid, url.searchParams.get("id"));
        const [order, payments, refund] = await Promise.all([
          context.admin.from("orders").select("*").eq("id", id).single(),
          context.admin
            .from("payment_attempts")
            .select("id,provider_payment_id,status,amount_paise,created_at")
            .eq("order_id", id),
          context.admin.rpc("refund_evidence", { p_order: id }),
        ]);
        databaseError(order.error);
        databaseError(payments.error);
        databaseError(refund.error);
        return json({
          order: order.data,
          payments: payments.data,
          evidence: refund.data,
          providerActionsAvailable:
            cashfreeSandboxEnabled() &&
            order.data?.provider_order_id?.startsWith("cf_sbx_") === true,
        });
      }
      if (action === "export") {
        const result = await orderQuery(context, url, true);
        await audit(context, "orders_exported", String(result.items.length));
        const csv = csvRows([
          [
            "Order",
            "Student ID",
            "Course",
            "Status",
            "Total INR",
            "GST INR",
            "Provider order",
            "Created",
          ],
          ...result.items.map((o) => [
            o.id,
            o.user_id,
            (o.course_snapshot as { title?: string }).title ?? o.course_id,
            o.status,
            (o.total_paise / 100).toFixed(2),
            (o.tax_paise / 100).toFixed(2),
            o.provider_order_id,
            o.created_at,
          ]),
        ]);
        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": "attachment; filename=orders.csv",
            "Cache-Control": "private, no-store",
            "X-Export-Limit": "1000",
            "X-Export-Truncated": String(result.total > result.items.length),
          },
        });
      }
      if (action === "refunds") {
        let q = context.admin
          .from("refund_requests")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false });
        const state = url.searchParams.get("state");
        if (
          state &&
          ["requested", "approved", "processing", "failed", "rejected", "refunded"].includes(state)
        )
          q = q.eq("state", state);
        const page = pageNumber(url.searchParams.get("page"));
        const result = await q.range(page * 50, page * 50 + 49);
        databaseError(result.error);
        const items = await Promise.all(
          (result.data ?? []).map(async (r) => {
            const e = await context.admin.rpc("refund_evidence", { p_order: r.order_id });
            databaseError(e.error);
            return { ...r, current_evidence: e.data };
          }),
        );
        return json({
          items,
          total: result.count,
          providerActionsAvailable: cashfreeSandboxEnabled(),
        });
      }
      if (action === "settings") {
        const r = await context.admin.from("site_settings").select("*").eq("id", true).single();
        databaseError(r.error);
        return json(r.data);
      }
      if (action === "content") {
        const r = await context.admin.from("site_content").select("*").eq("id", true).single();
        databaseError(r.error);
        return json(r.data);
      }
      if (action === "coupons") {
        const r = await context.admin
          .from("coupons")
          .select("*,coupon_redemptions(state)")
          .order("created_at", { ascending: false })
          .limit(200);
        databaseError(r.error);
        return json({ items: r.data });
      }
      if (action === "audit") {
        const page = pageNumber(url.searchParams.get("page"));
        const r = await context.admin
          .from("audit_log")
          .select("id,actor_id,action,target_type,target_id,details,created_at")
          .order("id", { ascending: false })
          .range(page * 50, page * 50 + 49);
        databaseError(r.error);
        return json({ items: r.data });
      }
      if (action === "tasks") {
        const r = await context.admin
          .from("operations_tasks")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        databaseError(r.error);
        if (!r.data?.length) return json({ items: [] });
        const ids = [...new Set(r.data.map((task) => task.user_id))];
        const enrollments = await context.admin
          .from("enrollments")
          .select("user_id,course_id,order_id")
          .in("user_id", ids)
          .eq("source", "purchase")
          .eq("active", true)
          .is("revoked_at", null);
        databaseError(enrollments.error);
        const orderIds = (enrollments.data ?? [])
          .map((e) => e.order_id)
          .filter((id): id is string => !!id);
        const orders = orderIds.length
          ? await context.admin
              .from("orders")
              .select("id,user_id,course_id,status")
              .in("id", orderIds)
              .eq("status", "paid")
          : { data: [], error: null };
        databaseError(orders.error);
        const buyers = new Set(
          (enrollments.data ?? [])
            .filter((e) =>
              orders.data?.some(
                (o) =>
                  o.id === e.order_id && o.user_id === e.user_id && o.course_id === e.course_id,
              ),
            )
            .map((e) => e.user_id),
        );
        return json({
          items: r.data.map((task) => ({
            ...task,
            qualifyingPaidAccessNow: buyers.has(task.user_id),
          })),
        });
      }
      if (action === "notifications") {
        const r = await context.admin
          .from("notification_outbox")
          .select("id,state,attempts,subject,created_at,next_attempt_at")
          .order("created_at", { ascending: false })
          .limit(100);
        databaseError(r.error);
        return json({ items: r.data });
      }
      throw new AuthError(404, "Admin resource not found.");
    }
    if (request.method !== "POST") throw new AuthError(405, "Method not allowed.");
    await limit(request, "admin-mutation", context.user.id, 100, 60);
    if (action === "cashfree-reconcile" || action === "refund-process") {
      if (!cashfreeSandboxEnabled())
        throw new AuthError(404, "Sandbox provider actions are disabled.");
      const input = parse(z.object({ id: uuid }).strict(), await body(request));
      const store = commerceStore(context.admin);
      const client = new CashfreeClient();
      let state;
      if (action === "cashfree-reconcile") {
        const order = await context.admin
          .from("orders")
          .select("provider_order_id")
          .eq("id", input.id)
          .single();
        databaseError(order.error);
        if (!order.data?.provider_order_id?.startsWith("cf_sbx_"))
          throw new AuthError(400, "Not a sandbox Cashfree order.");
        state = await reconcilePayment(client, store, order.data.provider_order_id);
      } else {
        const requestRow = await context.admin
          .from("refund_requests")
          .select("provider_reference,order_id")
          .eq("id", input.id)
          .single();
        databaseError(requestRow.error);
        const order = await context.admin
          .from("orders")
          .select("provider_order_id")
          .eq("id", requestRow.data!.order_id)
          .single();
        databaseError(order.error);
        if (!order.data?.provider_order_id?.startsWith("cf_sbx_"))
          throw new AuthError(400, "Not a sandbox Cashfree order.");
        state = await reconcileRefund(
          client,
          store,
          order.data.provider_order_id,
          requestRow.data!.provider_reference,
          true,
        );
      }
      await audit(context, action, input.id);
      return json({ state, message: `Sandbox provider state: ${state}.` });
    }
    if (action === "video-status") {
      const input = parse(
        z.object({ videoId: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/) }).strict(),
        await body(request),
      );
      return json(await videoStatus(input.videoId));
    }
    if (action === "video-upload") {
      const input = parse(
        z.object({ title: z.string().trim().min(2).max(180) }).strict(),
        await body(request),
      );
      await limit(request, "video-upload", context.user.id, 20, 3600);
      const upload = await videoUpload(input.title);
      await audit(context, "video_upload_prepared", upload.videoId);
      return json(upload);
    }
    if (action === "reconcile" || action === "invoice-resend" || action === "refund-process")
      throw new AuthError(
        503,
        "Payment-provider processing and invoices are deferred until Phase 3 is connected.",
        "PAYMENTS_DEFERRED",
      );
    if (action !== "operations") throw new AuthError(404, "Admin resource not found.");
    const envelope = parse(
      z
        .object({
          action: z.enum(Object.keys(operationSchemas) as [AdminAction, ...AdminAction[]]),
          data: z.unknown(),
        })
        .strict(),
      await body(request, 65536),
    );
    if (context.profile.role !== "admin" && !["grant", "refund_decide"].includes(envelope.action))
      throw new AuthError(403, "This action requires an administrator.", "FORBIDDEN");
    const data = parse(
      operationSchemas[envelope.action] as z.ZodType<Record<string, unknown>>,
      envelope.data,
    );
    if (envelope.action === "course_delete" || envelope.action === "lesson_delete") {
      const deleted = await context.admin.rpc(
        envelope.action === "course_delete" ? "admin_delete_course" : "admin_delete_lesson",
        envelope.action === "course_delete"
          ? {
              p_actor: context.user.id,
              p_session: context.sessionId,
              p_course: data.courseId,
              p_version: data.version,
            }
          : {
              p_actor: context.user.id,
              p_session: context.sessionId,
              p_course: data.courseId,
              p_module: data.moduleId,
              p_lesson: data.lessonId,
              p_version: data.version,
            },
      );
      databaseError(deleted.error);
      return json({ message: "Deleted successfully.", ...deleted.data });
    }
    if (context.profile.role === "support" && envelope.action === "grant") {
      const target = await context.admin
        .from("profiles")
        .select("role,blocked")
        .eq("id", String(data.userId))
        .single();
      databaseError(target.error);
      if (!target.data || target.data.role !== "student" || target.data.blocked)
        throw new AuthError(403, "Support can grant access to active students only.", "FORBIDDEN");
    }
    if (envelope.action === "lesson_save" && data.videoId) {
      const status = await videoStatus(String(data.videoId));
      data.provider_status = status.status;
      data.verified_duration = status.duration;
      if (
        data.published &&
        (status.status !== "ready" || status.duration !== data.duration_seconds)
      )
        throw new AuthError(
          400,
          "The video must be ready and its duration must match before publishing.",
        );
    }
    if (envelope.action === "lesson_save" && data.published && !data.videoId)
      throw new AuthError(400, "Add a ready video before publishing this lesson.");
    if (envelope.action === "lesson_save" && data.published === false && data.id) {
      const course = await getCourse(context, String(data.courseId));
      if (course.version !== data.version)
        throw new AuthError(409, "Reload this course before changing lessons.", "STALE_RECORD");
      const live = course.modules.flatMap((m) => m.lessons).filter((l) => l.published);
      if (course.status === "published" && live.length === 1 && live[0].id === data.id)
        throw new AuthError(400, "Unpublish the course before removing its last published lesson.");
    }
    if (envelope.action === "course_state" && data.status === "published") {
      const course = await getCourse(context, String(data.courseId));
      if (course.version !== data.version)
        throw new AuthError(409, "Reload this course before publishing.");
      const lessons = course.modules.flatMap((m) => m.lessons).filter((l) => l.published);
      if (!lessons.length || lessons.length > 100)
        throw new AuthError(400, "Publish between one and 100 verified lessons first.");
      for (let i = 0; i < lessons.length; i += 4) {
        await Promise.all(
          lessons.slice(i, i + 4).map(async (l) => {
            const asset = l.lesson_assets as { provider_video_id: string } | null;
            if (!asset?.provider_video_id)
              throw new AuthError(400, "Every published lesson needs a video.");
            const status = await videoStatus(asset.provider_video_id);
            if (status.status !== "ready" || status.duration !== l.duration_seconds)
              throw new AuthError(400, "A lesson video is not ready or its duration changed.");
          }),
        );
      }
    }
    const result = await context.admin.rpc("admin_mutate", {
      p_actor: context.user.id,
      p_session: context.sessionId,
      p_action: envelope.action,
      p_data: data,
    });
    if (envelope.action === "task_done" && result.error?.code === "22023")
      throw new AuthError(
        409,
        "This task changed or the learner has qualifying paid access. Refresh before taking action.",
        "TASK_CHANGED",
      );
    databaseError(result.error);
    return json({ message: "Saved successfully.", ...result.data });
  } catch (error) {
    return failure(error);
  }
}
