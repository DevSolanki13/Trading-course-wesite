export const metadata = { title: "Your learning space", robots: { index: false, follow: false } };
import { redirect } from "next/navigation";
import AuthPage from "@/frontend/pages/auth-page";
import { purchaseUser } from "@/backend/purchase/session";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, user] = await Promise.all([searchParams, purchaseUser(false).catch(() => null)]);
  if (user?.role === "admin") {
    redirect("/admin");
  }
  return (
    <AuthPage
      mode="login"
      next={
        typeof query.redirect === "string"
          ? query.redirect
          : typeof query.next === "string"
            ? query.next
            : "/dashboard?view=explore"
      }
      error={
        query.error === "oauth"
          ? "Google sign-in could not be completed. Please try again or use email and password."
          : undefined
      }
      notice={
        query.message === "password-updated"
          ? "Password updated. Sign in with your new password."
          : undefined
      }
    />
  );
}
