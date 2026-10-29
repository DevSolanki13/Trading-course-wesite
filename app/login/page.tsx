export const metadata = { title: "Your learning space", robots: { index: false, follow: false } };
import AuthPage from "@/frontend/pages/auth-page";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <AuthPage
      mode="login"
      next={typeof query.next === "string" ? query.next : undefined}
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
