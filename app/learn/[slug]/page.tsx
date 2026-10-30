import { LearningWorkspace } from "@/frontend/components/learning-workspace";
import "@/frontend/styles/auth.css";
import "@/frontend/styles/learning.css";
import { redirect, notFound } from "next/navigation";
import { localDemoEnabled } from "@/backend/purchase/mode";
import { purchaseCourse } from "@/backend/purchase/repository";
import { purchaseUser } from "@/backend/purchase/session";
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
  if (localDemoEnabled()) {
    const user = await purchaseUser(false);
    const course = await purchaseCourse(slug, user?.id ?? null);
    if (!course) notFound();
    const lessons = course.modules.flatMap((m) => m.lessons);
    const requested =
      typeof query.lesson === "string" ? lessons.find((l) => l.id === query.lesson) : null;
    const first = requested ?? lessons.find((l) => !l.completed) ?? lessons[0];
    if (!first) notFound();
    redirect(`/learn/${course.slug}/${first.id}`);
  }
  const user = await purchaseUser(false);
  const course = await purchaseCourse(slug, user?.id ?? null);
  if (!course) notFound();
  const preview =
    typeof query.lesson === "string" &&
    course.modules.flatMap((m) => m.lessons).some((l) => l.id === query.lesson && l.preview);
  if (!course.owned && !preview) redirect(`/courses/${course.slug}?message=purchase-to-unlock`);
  return (
    <LearningWorkspace
      slug={slug}
      initialLesson={typeof query.lesson === "string" ? query.lesson : undefined}
    />
  );
}
