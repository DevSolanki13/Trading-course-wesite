import "server-only";
import type { Identity } from "../auth/session";
import { AuthError } from "../auth/http";
import type { AdminCourse } from "../../shared/admin";
import type { AdminCourseLearners } from "../../shared/admin";
import { localDatabase } from "../local/database";
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

export async function localCourseLearners(courseId: string): Promise<AdminCourseLearners> {
  const db = await localDatabase();
  const course = (
    await db.query<AdminCourseLearners["course"]>(
      "select id,title,slug,status from courses where id=$1",
      [courseId],
    )
  ).rows[0];
  if (!course) throw new AuthError(404, "Course not found.");
  const lessons = (
    await db.query<{
      id: string;
      title: string;
      moduleTitle: string;
      durationSeconds: number;
      modulePosition: number;
      lessonPosition: number;
    }>(
      'select l.id,l.title,m.title as "moduleTitle",l.duration_seconds as "durationSeconds",m.position as "modulePosition",l.position as "lessonPosition" from modules m join lessons l on l.module_id=m.id where m.course_id=$1 and l.published order by m.position,l.position',
      [courseId],
    )
  ).rows;
  const enrollments = (
    await db.query<{
      id: string;
      name: string;
      email: string;
      grantedAt: string;
      expiresAt: string | null;
      active: boolean;
      revokedAt: string | null;
      userId: string;
    }>(
      'select e.user_id as "userId",p.full_name as name,u.email,e.granted_at as "grantedAt",e.expires_at as "expiresAt",e.active,e.revoked_at as "revokedAt" from enrollments e join orders o on o.id=e.order_id and o.status=\'paid\' and o.user_id=e.user_id and o.course_id=e.course_id join profiles p on p.id=e.user_id join auth.users u on u.id=p.id where e.course_id=$1 and e.source=\'purchase\' order by p.full_name,u.email',
      [courseId],
    )
  ).rows;
  const progress = (
    await db.query<{
      userId: string;
      lessonId: string;
      positionSeconds: number;
      watchedSeconds: number;
      completed: boolean;
      updatedAt: string;
    }>(
      'select lp.user_id as "userId",lp.lesson_id as "lessonId",lp.position_ms/1000.0 as "positionSeconds",coalesce((select sum(upper(r)-lower(r))/1000.0 from unnest(lp.watched) r),0) as "watchedSeconds",lp.completed,lp.updated_at as "updatedAt" from lesson_progress lp join lessons l on l.id=lp.lesson_id join modules m on m.id=l.module_id where m.course_id=$1',
      [courseId],
    )
  ).rows;
  const learners = enrollments.map((enrollment) => {
    const records = new Map(
      progress.filter((row) => row.userId === enrollment.userId).map((row) => [row.lessonId, row]),
    );
    const lessonRows = lessons.map((lesson) => {
      const row = records.get(lesson.id);
      return {
        lessonId: lesson.id,
        title: lesson.title,
        moduleTitle: lesson.moduleTitle,
        completed: row?.completed ?? false,
        positionSeconds: Number(row?.positionSeconds ?? 0),
        watchedSeconds: Number(row?.watchedSeconds ?? 0),
        updatedAt: row?.updatedAt ?? null,
      };
    });
    const completedLessons = lessonRows.filter((lesson) => lesson.completed).length;
    const lastActiveAt = lessonRows.reduce<string | null>(
      (latest, lesson) =>
        !latest || (lesson.updatedAt && lesson.updatedAt > latest) ? lesson.updatedAt : latest,
      null,
    );
    return {
      id: enrollment.userId,
      name: enrollment.name,
      email: enrollment.email,
      grantedAt: enrollment.grantedAt,
      expiresAt: enrollment.expiresAt,
      active:
        enrollment.active &&
        !enrollment.revokedAt &&
        (!enrollment.expiresAt || new Date(enrollment.expiresAt).getTime() > Date.now()),
      progressPercent: lessons.length ? Math.round((completedLessons * 100) / lessons.length) : 0,
      completedLessons,
      totalLessons: lessons.length,
      watchedSeconds: lessonRows.reduce((total, lesson) => total + lesson.watchedSeconds, 0),
      lastActiveAt,
      lessons: lessonRows,
    };
  });
  return {
    course: {
      id: course.id,
      title: course.title,
      slug: course.slug,
      status: course.status,
      lessonCount: lessons.length,
      lessons: lessons.map(({ id, title, moduleTitle, durationSeconds }) => ({
        id,
        title,
        moduleTitle,
        durationSeconds,
      })),
    },
    learners,
  };
}
