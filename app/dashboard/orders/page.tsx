import { requirePurchaseUser } from "@/backend/purchase/pages";
import { purchaseCatalog, purchaseOrdersPage } from "@/backend/purchase/repository";
import { localDemoEnabled } from "@/backend/purchase/mode";
import { PurchaseDashboard } from "@/frontend/components/purchase-dashboard";
import { redirect } from "next/navigation";
import "@/frontend/styles/learning.css";
import "@/frontend/styles/admin.css";
import "@/frontend/styles/student-dashboard.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Purchase history",
  robots: { index: false, follow: false },
};
export default async function Orders() {
  const user = await requirePurchaseUser("/dashboard/orders");
  if (user.role === "admin") {
    redirect("/admin");
  }
  const [courses, page] = await Promise.all([
    purchaseCatalog(user.id),
    purchaseOrdersPage(user.id),
  ]);
  return (
    <PurchaseDashboard
      user={user}
      courses={courses.filter((c) => c.owned || c.accessExpiresAt)}
      allCourses={courses}
      orders={page.orders}
      orderCount={page.totalCount}
      ordersPage={page}
      ordersFresh
      ordersOnly
      local={localDemoEnabled()}
    />
  );
}
