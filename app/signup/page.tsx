import AuthPage from "@/frontend/pages/auth-page";
export const metadata = { title: "Create your account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return <AuthPage mode="signup" next={typeof query.next === "string" ? query.next : undefined} />;
}
