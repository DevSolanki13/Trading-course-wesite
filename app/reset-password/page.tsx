import AuthPage from "@/frontend/pages/auth-page";
export const metadata = { title: "Set your password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return <AuthPage mode="reset" invitation={query.mode === "invite"} />;
}
