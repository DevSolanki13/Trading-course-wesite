import { LearningWorkspace } from "@/frontend/components/learning-workspace";
import "@/frontend/styles/auth.css";
import "@/frontend/styles/learning.css";
export const metadata = { title: "Your classroom", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Classroom({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  return (
    <LearningWorkspace
      slug={slug}
      initialLesson={typeof query.lesson === "string" ? query.lesson : undefined}
    />
  );
}
