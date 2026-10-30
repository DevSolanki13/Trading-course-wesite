import { AdminWorkspace } from "@/frontend/components/admin/admin-workspace";
import "@/frontend/styles/auth.css";
import "@/frontend/styles/admin.css";
export const metadata = {
  title: "Team workspace",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default function Admin() {
  return <AdminWorkspace />;
}
