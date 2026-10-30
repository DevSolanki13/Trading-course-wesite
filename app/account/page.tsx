import { AccountWorkspace } from "@/frontend/components/account-workspace";
import "@/frontend/styles/auth.css";
import { localDemoEnabled } from "@/backend/purchase/mode";
import { redirect } from "next/navigation";
export const metadata = { title: "Your account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function Account() {
  if (localDemoEnabled()) redirect("/dashboard");
  return <AccountWorkspace />;
}
