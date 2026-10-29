import AuthPage from "@/frontend/pages/auth-page";
export const metadata = { title: "Confirm your email", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Confirm({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <AuthPage mode="confirm" token={typeof query.token === "string" ? query.token : undefined} />
  );
}
