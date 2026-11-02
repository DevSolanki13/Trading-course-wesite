"use client";

import { StudentDashboard } from "./student-dashboard";
import type { PurchaseUser, PurchaseCourse, PurchaseOrder } from "../../shared/purchase";
import type { Announcement } from "../../shared/announcements";

export function PurchaseDashboard({
  user,
  courses,
  allCourses,
  orders,
  announcements,
  ordersOnly = false,
  local = false,
  initialCourseSlug,
  initialLessonId,
  initialView = "courses",
}: {
  user: PurchaseUser;
  courses: PurchaseCourse[];
  allCourses?: PurchaseCourse[];
  orders: PurchaseOrder[];
  announcements?: Announcement[];
  ordersOnly?: boolean;
  local?: boolean;
  initialCourseSlug?: string;
  initialLessonId?: string;
  initialView?: "courses" | "explore" | "billing" | "account";
}) {
  return (
    <StudentDashboard
      user={user}
      courses={courses}
      allCourses={allCourses}
      orders={orders}
      announcements={announcements}
      ordersOnly={ordersOnly}
      local={local}
      initialCourseSlug={initialCourseSlug}
      initialLessonId={initialLessonId}
      initialView={initialView}
    />
  );
}
export { StudentDashboard };
