import "server-only";
import { createAdminClient } from "../database/supabase";
import { admitted } from "../auth/session";
import { AuthError } from "../auth/http";
import { hasCourseAccess, refundEligibility, snapshotMatches } from "./policy";
import type { CourseView, LibraryView } from "../../shared/learning";

type Row = {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  language: string;
  modules: {
    id: string;
    title: string;
    position: number;
    lessons: {
      id: string;
      title: string;
      position: number;
      duration_seconds: number;
      is_preview: boolean;
      published: boolean;
    }[];
  }[];
};
type Progress = {
  lesson_id: string;
  position_ms: number;
  duration_seconds: number;
  watched_seconds: number;
  completed: boolean;
  updated_at: string;
};
export const graphSelect =
  "id,slug,title,description,level,language,modules(id,title,position,lessons(id,title,position,duration_seconds,is_preview,published))";
/** A course scope is used for lesson authorization, which does not need account-wide progress. */
export async function learningAccount(courseId?: string) {
  const context = await admitted();
  let enrollmentQuery = context.admin
    .from("enrollments")
    .select("course_id,source,order_id,active,revoked_at,expires_at")
    .eq("user_id", context.user.id);
  let orderQuery = context.admin
    .from("orders")
    .select(
      "id,user_id,course_id,status,total_paise,course_snapshot,refund_policy_snapshot,paid_at,created_at",
    )
    .eq("user_id", context.user.id)
    .order("created_at", { ascending: false });
  if (courseId) {
    enrollmentQuery = enrollmentQuery.eq("course_id", courseId);
    orderQuery = orderQuery.eq("course_id", courseId);
  }
  const [enrollments, orders, progress] = await Promise.all([
    enrollmentQuery,
    orderQuery,
    courseId
      ? Promise.resolve({ data: [], error: null })
      : context.admin.rpc("learning_progress", { p_user: context.user.id }),
  ]);
  if (enrollments.error || orders.error || progress.error)
    throw new AuthError(503, "Learning records are temporarily unavailable.");
  return {
    context,
    enrollments: enrollments.data,
    orders: orders.data,
    progress: progress.data as Progress[],
  };
}
export type LearningAccount = Awaited<ReturnType<typeof learningAccount>>;
export function courseView(row: Row, account: LearningAccount | null): CourseView {
  const owned = account
    ? hasCourseAccess(account.enrollments, account.orders, row.id, account.context.user.id)
    : false;
  const modules = row.modules
    .sort((a, b) => a.position - b.position)
    .map((m) => ({
      id: m.id,
      title: m.title,
      lessons: m.lessons
        .filter((l) => l.published)
        .sort((a, b) => a.position - b.position)
        .map((l) => {
          const p = account?.progress.find((p) => p.lesson_id === l.id);
          return {
            id: l.id,
            title: l.title,
            duration: l.duration_seconds,
            preview: l.is_preview,
            completed: p?.completed ?? false,
            position: (p?.position_ms ?? 0) / 1000,
            watchedSeconds: Number(p?.watched_seconds ?? 0),
          };
        }),
    }));
  const lessons = modules.flatMap((m) => m.lessons);
  const recent = account?.progress
    .filter((p) => lessons.some((l) => l.id === p.lesson_id))
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    level: row.level,
    language: row.language,
    modules,
    owned,
    accessExpiresAt:
      account?.enrollments
        .filter(
          (e) =>
            e.course_id === row.id &&
            e.active &&
            !e.revoked_at &&
            e.source === "purchase" &&
            e.expires_at &&
            Date.parse(e.expires_at) > Date.now() &&
            account.orders.some(
              (o) =>
                o.id === e.order_id &&
                o.status === "paid" &&
                !!o.paid_at &&
                Date.parse(o.paid_at) <= Date.now() &&
                o.course_id === row.id &&
                o.user_id === account.context.user.id,
            ),
        )
        .map((e) => e.expires_at as string)
        .filter(Boolean)
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null,
    progress: lessons.length
      ? Math.round((lessons.filter((l) => l.completed).length / lessons.length) * 100)
      : 0,
    resumeLessonId: recent?.lesson_id ?? lessons[0]?.id ?? null,
  };
}
export async function loadCourse(slug: string, account: LearningAccount | null) {
  const { data, error } = await createAdminClient()
    .from("courses")
    .select(graphSelect)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new AuthError(503, "The curriculum is temporarily unavailable.");
  if (!data) throw new AuthError(404, "This course is not published.", "NOT_FOUND");
  return courseView(data as Row, account);
}
function safeSocial(value: unknown, hosts: string[]) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" &&
      hosts.includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export async function library(account: LearningAccount): Promise<LibraryView> {
  const [courses, settings] = await Promise.all([
    account.context.admin
      .from("courses")
      .select(graphSelect)
      .eq("status", "published")
      .order("created_at"),
    account.context.admin
      .from("site_settings")
      .select(
        "public_telegram_url,public_instagram_url,private_telegram_url,private_invite_expires_at",
      )
      .eq("id", true)
      .single(),
  ]);
  if (courses.error || settings.error)
    throw new AuthError(503, "Your library is temporarily unavailable.");
  const mapped = (courses.data as Row[]).map((c) => courseView(c, account));
  const eligible = account.enrollments.some(
    (e) =>
      e.source === "purchase" &&
      hasCourseAccess([e], account.orders, e.course_id, account.context.user.id),
  );
  const expiresAt = settings.data.private_invite_expires_at;
  return {
    name: account.context.profile.full_name,
    courses: mapped.filter((c) => c.owned),
    browse: mapped.filter((c) => !c.owned),
    orders: account.orders.map((o) => {
      const snapshot = o.course_snapshot as { title?: string; duration_seconds?: number };
      const course = mapped.find((c) => c.id === o.course_id);
      const watched =
        course?.modules
          .flatMap((m) => m.lessons)
          .filter((l) => !l.preview)
          .reduce((sum, l) => sum + l.watchedSeconds, 0) ?? 0;
      return {
        id: o.id,
        courseTitle: snapshot.title ?? course?.title ?? "Course",
        status: o.status,
        total: o.total_paise,
        createdAt: o.created_at,
        paidAt: o.paid_at,
        refund: refundEligibility(
          o.paid_at,
          o.status,
          o.refund_policy_snapshot,
          course &&
            snapshotMatches(
              snapshot,
              course.modules.flatMap((m) => m.lessons),
            )
            ? snapshot.duration_seconds
            : undefined,
          watched,
        ),
      };
    }),
    community: {
      eligible,
      telegram: safeSocial(settings.data.public_telegram_url, ["t.me", "telegram.me"]),
      instagram: safeSocial(settings.data.public_instagram_url, [
        "instagram.com",
        "www.instagram.com",
      ]),
      privateInvite:
        eligible && expiresAt && Date.parse(expiresAt) > Date.now()
          ? safeSocial(settings.data.private_telegram_url, ["t.me", "telegram.me"])
          : null,
      expiresAt: eligible ? expiresAt : null,
    },
  };
}
type LessonMetadata = {
  id: string;
  module_id: string;
  title: string;
  is_preview: boolean;
  published: boolean;
  duration_seconds: number;
  modules: { course_id: string; courses: { id: string; status: string } | null } | null;
};

export async function lessonAccess(
  lessonId: string,
  accountOrLoad: LearningAccount | null | ((courseId: string) => Promise<LearningAccount | null>),
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lessons")
    .select(
      "id,module_id,title,is_preview,published,duration_seconds,modules!inner(course_id,courses!inner(id,status))",
    )
    .eq("id", lessonId)
    .maybeSingle();
  if (error) throw new AuthError(503, "Lesson information is unavailable.");
  const metadata = data as unknown as LessonMetadata | null;
  const course = metadata?.modules?.courses;
  if (!metadata?.published || !course || course.status !== "published")
    throw new AuthError(404, "Lesson not found.");
  const { modules: module, ...lesson } = metadata;
  if (module?.course_id !== course.id) throw new AuthError(404, "Lesson not found.");
  const account =
    typeof accountOrLoad === "function" ? await accountOrLoad(course.id) : accountOrLoad;
  if (
    !lesson.is_preview &&
    (!account ||
      !hasCourseAccess(account.enrollments, account.orders, course.id, account.context.user.id))
  )
    throw new AuthError(
      account ? 403 : 401,
      "A current course enrollment is required.",
      account ? "COURSE_LOCKED" : "SIGN_IN_REQUIRED",
    );
  const accessExpiresAt =
    account?.enrollments
      .filter((e) => hasCourseAccess([e], account.orders, course.id, account.context.user.id))
      .map((e) => e.expires_at as string)
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  return { lesson, admin, accessExpiresAt, account };
}
