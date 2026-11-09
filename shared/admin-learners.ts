import type { AdminCourseLearnerLesson, AdminCourseLearners } from "./admin";

export type AdminLearnerSummary = Omit<AdminCourseLearners["learners"][number], "lessons"> & {
  enrollmentId: string;
};
export type AdminLearnerCourse = Omit<AdminCourseLearners["course"], "lessons">;
export type AdminLearnerPage = {
  course: AdminLearnerCourse;
  learners: AdminLearnerSummary[];
  enrolledTotal: number;
  total: number;
  page: number;
  pageSize: number;
};
export type AdminLearnerDetail = {
  course: AdminLearnerCourse;
  learner: AdminLearnerSummary & { lessons: AdminCourseLearnerLesson[] };
};
