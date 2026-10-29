import AuthPage from "@/frontend/pages/auth-page";
export const metadata = { title: "Staff sign-in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function AdminLogin() {
  return <AuthPage mode="login" admin next="/admin" />;
}
