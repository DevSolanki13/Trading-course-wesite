import { requirePurchaseUser } from "@/backend/purchase/pages";
import { purchaseCatalog, purchaseOrders } from "@/backend/purchase/repository";
import { localDemoEnabled } from "@/backend/purchase/mode";
import { listAnnouncements } from "@/backend/announcements/service";
import { PurchaseDashboard } from "@/frontend/components/purchase-dashboard";
import { redirect } from "next/navigation";
import "@/frontend/styles/learning.css";
import "@/frontend/styles/admin.css";
import "@/frontend/styles/student-dashboard.css";
import "@/frontend/styles/video-learning.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Student Dashboard",
  robots: { index: false, follow: false },
};
export default async function Dashboard({
  searchParams,
}: {
  searchParams?: Promise<{ course?: string; lesson?: string; view?: string; tab?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const user = await requirePurchaseUser("/dashboard");
  if (user.role === "admin") {
    redirect("/admin");
  }
  const [courses, orders, announcements] = await Promise.all([
    purchaseCatalog(user.id),
    purchaseOrders(user.id),
    listAnnouncements(true),
  ]);
  const viewParam = query.view || query.tab;
  const ownedCourses = courses.filter((c) => c.owned || c.accessExpiresAt);
  const initialView =
    viewParam === "courses" || viewParam === "study"
      ? "courses"
      : viewParam === "billing" || viewParam === "orders"
        ? "billing"
        : viewParam === "account" || viewParam === "profile"
          ? "account"
          : query.course || ownedCourses.length > 0
            ? "courses"
            : "explore";

  return (
    <PurchaseDashboard
      user={user}
      courses={ownedCourses}
      allCourses={courses}
      orders={orders}
      announcements={announcements}
      local={localDemoEnabled()}
      initialCourseSlug={query.course}
      initialLessonId={query.lesson}
      initialView={initialView}
    />
  );
}
