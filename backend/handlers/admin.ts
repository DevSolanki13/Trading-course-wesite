import "server-only";
import { z } from "zod";
import { privileged, audit } from "../auth/session";
import { AuthError, body, failure, json, limit, sameOrigin } from "../auth/http";
import { operationSchemas, type AdminAction } from "../admin/validation";
import { databaseError, getCourse, orderQuery, overview } from "../admin/data";
import { pageNumber, csvRows } from "../admin/policy";
import { videoStatus, videoUpload } from "../admin/video";
import { requireEnv } from "../config/env";
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
          .select("id,title,slug,status,price_paise,sale_price_paise,version,updated_at")
          .order("updated_at", { ascending: false })
          .limit(200);
        databaseError(r.error);
        return json({ items: r.data });
      }
      if (action === "course")
        return json({ course: await getCourse(context, parse(uuid, url.searchParams.get("id"))) });
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
        const rows=await context.admin.from("courses").select("id,title").in("status",["published","archived"]).order("title").limit(200);
        databaseError(rows.error);return json({courses:rows.data});
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
          providerActionsAvailable: false,
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
            "X-Export-Truncated": String(result.total>result.items.length),
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
        return json({ items, total: result.count, providerActionsAvailable: false });
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
        if(!r.data?.length)return json({items:[]});
        const ids=[...new Set(r.data.map(task=>task.user_id))];
        const enrollments=await context.admin.from("enrollments").select("user_id,course_id,order_id").in("user_id",ids).eq("source","purchase").eq("active",true).is("revoked_at",null);
        databaseError(enrollments.error);
        const orderIds=(enrollments.data??[]).map(e=>e.order_id).filter((id):id is string=>!!id);
        const orders=orderIds.length?await context.admin.from("orders").select("id,user_id,course_id,status").in("id",orderIds).eq("status","paid"):{data:[],error:null};
        databaseError(orders.error);
        const buyers=new Set((enrollments.data??[]).filter(e=>orders.data?.some(o=>o.id===e.order_id&&o.user_id===e.user_id&&o.course_id===e.course_id)).map(e=>e.user_id));
        return json({items:r.data.map(task=>({...task,qualifyingPaidAccessNow:buyers.has(task.user_id)}))});
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
      await body(request,65536),
    );
    if (context.profile.role !== "admin" && !["grant", "refund_decide"].includes(envelope.action))
      throw new AuthError(403, "This action requires an administrator.", "FORBIDDEN");
    const data = parse(
      operationSchemas[envelope.action] as z.ZodType<Record<string, unknown>>,
      envelope.data,
    );
    if(context.profile.role==="support"&&envelope.action==="grant"){
      const target=await context.admin.from("profiles").select("role,blocked").eq("id",String(data.userId)).single();
      databaseError(target.error);
      if(!target.data||target.data.role!=="student"||target.data.blocked)throw new AuthError(403,"Support can grant access to active students only.","FORBIDDEN");
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
      const course=await getCourse(context,String(data.courseId));
      if(course.version!==data.version)throw new AuthError(409,"Reload this course before changing lessons.","STALE_RECORD");
      const live=course.modules.flatMap(m=>m.lessons).filter(l=>l.published);
      if(course.status==="published"&&live.length===1&&live[0].id===data.id)
        throw new AuthError(400,"Unpublish the course before removing its last published lesson.");
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
    if(envelope.action==="task_done"&&result.error?.code==="22023")throw new AuthError(409,"This task changed or the learner has qualifying paid access. Refresh before taking action.","TASK_CHANGED");
    databaseError(result.error);
    return json({ message: "Saved successfully.", ...result.data });
  } catch (error) {
    return failure(error);
  }
}
