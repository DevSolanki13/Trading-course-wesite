export type Enrollment = {
  active: boolean;
  revoked_at: string | null;
  expires_at?: string | null;
  source: string;
  course_id: string;
  order_id: string | null;
};
export type Purchase = { id: string; user_id: string; course_id: string; status: string };
export function hasCourseAccess(
  enrollments: Enrollment[],
  orders: Purchase[],
  courseId: string,
  userId: string,
  now = Date.now(),
) {
  return enrollments.some(
    (e) =>
      e.course_id === courseId &&
      e.active &&
      !e.revoked_at &&
      !!e.expires_at &&
      Date.parse(e.expires_at) > now &&
      (e.source === "manual" ||
        (e.source === "purchase" &&
          orders.some(
            (o) =>
              o.id === e.order_id &&
              o.user_id === userId &&
              o.course_id === courseId &&
              o.status === "paid",
          ))),
  );
}
export function refundEligibility(
  paidAt: string | null,
  status: string,
  policy: unknown,
  duration: unknown,
  watched: number,
  now = Date.now(),
) {
  if (status !== "paid" || !paidAt)
    return { eligible: false, reason: "This order is not a confirmed payment." };
  const p = policy as { window_days?: number; watch_limit_percent?: number } | null;
  if (
    !p ||
    !Number.isFinite(p.window_days) ||
    !Number.isFinite(p.watch_limit_percent) ||
    p.window_days! < 0 ||
    p.window_days! > 365 ||
    p.watch_limit_percent! < 0 ||
    p.watch_limit_percent! > 100 ||
    !Number.isFinite(watched) ||
    watched < 0 ||
    typeof duration !== "number" ||
    duration <= 0
  )
    return {
      eligible: false,
      reason: "Purchase policy or duration snapshot is unavailable. Contact support for review.",
    };
  const deadline = Date.parse(paidAt) + p.window_days! * 86400000;
  if (!Number.isFinite(deadline))
    return { eligible: false, reason: "Purchase date requires support review." };
  const fraction = watched / duration;
  const eligible = now < deadline && fraction < p.watch_limit_percent! / 100;
  return {
    eligible,
    deadline: new Date(deadline).toISOString(),
    watchedPercent: Math.min(100, fraction * 100),
    reason:
      now >= deadline
        ? "The refund window has ended."
        : fraction >= p.watch_limit_percent! / 100
          ? "The watched-content limit has been reached."
          : "Within the recorded time and viewing limits. Refund requests will open with the refund service.",
  };
}

/** Do not infer financial eligibility from a mutable or missing curriculum snapshot. */
export function snapshotMatches(
  snapshot: unknown,
  lessons: { id: string; duration: number; preview: boolean }[],
) {
  const source = snapshot as {
    duration_seconds?: unknown;
    lessons?: { id?: unknown; duration_seconds?: unknown; is_preview?: unknown }[];
  } | null;
  if (
    !source ||
    !Array.isArray(source.lessons) ||
    !source.lessons.length ||
    source.lessons.length !== lessons.length
  )
    return false;
  if (new Set(source.lessons.map((l) => l.id)).size !== source.lessons.length) return false;
  if (
    !source.lessons.every((l) =>
      lessons.some(
        (current) =>
          current.id === l.id &&
          current.duration === l.duration_seconds &&
          current.preview === l.is_preview,
      ),
    )
  )
    return false;
  return (
    source.duration_seconds ===
    lessons.filter((l) => !l.preview).reduce((n, l) => n + l.duration, 0)
  );
}
