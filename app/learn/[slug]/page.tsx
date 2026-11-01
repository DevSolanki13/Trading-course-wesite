import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your classroom", robots: { index: false, follow: false } };

export default async function Classroom({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const lesson = typeof query.lesson === "string" ? `&lesson=${encodeURIComponent(query.lesson)}` : "";
  redirect(`/dashboard?course=${encodeURIComponent(slug)}${lesson}`);
}
