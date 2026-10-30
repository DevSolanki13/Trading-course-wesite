import { requirePurchaseUser } from "@/backend/purchase/pages";
import { purchaseCatalog, purchaseOrders } from "@/backend/purchase/repository";
import { localDemoEnabled } from "@/backend/purchase/mode";
import { PurchaseDashboard } from "@/frontend/components/purchase-dashboard";
import "@/frontend/styles/learning.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "My courses", robots: { index: false, follow: false } };
export default async function Dashboard() {
  const user = await requirePurchaseUser("/dashboard");
  const [courses, orders] = await Promise.all([purchaseCatalog(user.id), purchaseOrders(user.id)]);
  return (
    <PurchaseDashboard
      user={user}
      courses={courses.filter((c) => c.owned)}
      orders={orders}
      local={localDemoEnabled()}
    />
  );
}
