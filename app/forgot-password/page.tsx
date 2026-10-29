import AuthPage from "@/frontend/pages/auth-page";
export const metadata = { title: "Password recovery", robots: { index: false, follow: false } };
export default function ForgotPassword() {
  return <AuthPage mode="forgot" />;
}
