import { AdminDirectTerminal } from "@/frontend/components/admin/admin-direct-terminal";

export const metadata = {
  title: "Admin Portal Sign-In",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default function AdminLogin() {
  return <AdminDirectTerminal />;
}
