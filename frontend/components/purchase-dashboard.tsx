"use client";

import { StudentDashboard } from "./student-dashboard";
import type { PurchaseUser, PurchaseCourse, PurchaseOrder } from "../../shared/purchase";

export function PurchaseDashboard({
  user,
  courses,
  allCourses,
  orders,
  ordersOnly = false,
  local = false,
  initialCourseSlug,
  initialLessonId,
}: {
  user: PurchaseUser;
  courses: PurchaseCourse[];
  allCourses?: PurchaseCourse[];
  orders: PurchaseOrder[];
  ordersOnly?: boolean;
  local?: boolean;
  initialCourseSlug?: string;
  initialLessonId?: string;
}) {
  return (
    <StudentDashboard
      user={user}
      courses={courses}
      allCourses={allCourses}
      orders={orders}
      ordersOnly={ordersOnly}
      local={local}
      initialCourseSlug={initialCourseSlug}
      initialLessonId={initialLessonId}
    />
  );
}
export { StudentDashboard };
