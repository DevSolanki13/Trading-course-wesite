import { AccountWorkspace } from "@/frontend/components/account-workspace";
import "@/frontend/styles/auth.css";
export const metadata = {
  title: "Team access & security",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default function Admin() {
  return <AccountWorkspace admin />;
}
