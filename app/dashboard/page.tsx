import { requirePurchaseUser } from "@/backend/purchase/pages";
import {
  purchaseCatalog,
  purchaseOrdersPage,
  purchaseOrderCount,
} from "@/backend/purchase/repository";
import { localDemoEnabled } from "@/backend/purchase/mode";
import { listAnnouncements } from "@/backend/announcements/service";
import { PurchaseDashboard } from "@/frontend/components/purchase-dashboard";
import { redirect } from "next/navigation";
import "@/frontend/styles/learning.css";
import "@/frontend/styles/admin.css";
import "@/frontend/styles/auth.css";
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
  const viewParam = query.view || query.tab;
  const billingRequested = viewParam === "billing" || viewParam === "orders";
  const [courses, billing, announcements] = await Promise.all([
    purchaseCatalog(user.id),
    billingRequested
      ? purchaseOrdersPage(user.id).then((page) => ({
          orders: page.orders,
          count: page.totalCount,
          page,
        }))
      : purchaseOrderCount(user.id).then((count) => ({ orders: [], count, page: undefined })),
    listAnnouncements(true),
  ]);
  const ownedCourses = courses.filter((c) => c.owned || c.accessExpiresAt);
  const initialView =
    viewParam === "courses" || viewParam === "study"
      ? "courses"
      : viewParam === "billing" || viewParam === "orders"
        ? "billing"
        : viewParam === "explore"
          ? "explore"
          : viewParam === "account" || viewParam === "profile" || viewParam === "devices"
            ? "account"
            : query.course || ownedCourses.length > 0
              ? "courses"
              : "explore";

  return (
    <PurchaseDashboard
      user={user}
      courses={ownedCourses}
      allCourses={courses}
      orders={billing.orders}
      orderCount={billing.count}
      ordersFresh={billingRequested}
      ordersPage={billing.page}
      announcements={announcements}
      local={localDemoEnabled()}
      initialCourseSlug={query.course}
      initialLessonId={query.lesson}
      initialView={initialView}
    />
  );
}
