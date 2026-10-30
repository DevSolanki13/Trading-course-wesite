import { requirePurchaseUser } from "@/backend/purchase/pages";
import { purchaseOrders } from "@/backend/purchase/repository";
import { localDemoEnabled } from "@/backend/purchase/mode";
import { PurchaseDashboard } from "@/frontend/components/purchase-dashboard";
import "@/frontend/styles/learning.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Purchase history", robots: { index: false, follow: false } };
export default async function Orders() {
  const user = await requirePurchaseUser("/dashboard/orders");
  return (
    <PurchaseDashboard
      user={user}
      courses={[]}
      orders={await purchaseOrders(user.id)}
      ordersOnly
      local={localDemoEnabled()}
    />
  );
}
