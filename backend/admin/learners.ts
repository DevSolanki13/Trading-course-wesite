import "server-only";
import { z } from "zod";
import { AuthError } from "../auth/http";
import { pageNumber } from "./policy";

export function learnerParams(url: URL) {
  const course = z.uuid().safeParse(url.searchParams.get("courseId"));
  const learnerId = url.searchParams.get("learnerId");
  const learner = learnerId === null ? null : z.uuid().safeParse(learnerId);
  const access = url.searchParams.get("access") ?? "all";
  if (
    !course.success ||
    (learner && !learner.success) ||
    !["all", "active", "expired"].includes(access)
  )
    throw new AuthError(400, "Check the course, learner and access filter.");
  return {
    p_course: course.data,
    p_query: (url.searchParams.get("q") ?? "").trim().slice(0, 120),
    p_page: pageNumber(url.searchParams.get("page")),
    p_access: access,
    p_learner: learner?.data ?? null,
  };
}

export function learnerDatabaseError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "P0002") throw new AuthError(404, "Course or enrolled learner not found.");
  if (error.code === "42501") throw new AuthError(403, "This role cannot access course learners.");
  if (error.code === "22023") throw new AuthError(400, "Check the learner filters.");
  throw new AuthError(503, "Learners could not load. Please try again.");
}
