import { notFound, redirect } from "next/navigation";
import { purchaseUser } from "@/backend/purchase/session";
import { purchaseCourse, purchaseLesson } from "@/backend/purchase/repository";
import { localDemoEnabled } from "@/backend/purchase/mode";
import { PurchasePlayer } from "@/frontend/components/purchase-player";
import { LearningWorkspace } from "@/frontend/components/learning-workspace";
import "@/frontend/styles/learning.css";
import "@/frontend/styles/auth.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Course lesson", robots: { index: false, follow: false } };
export default async function Lesson({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const user = await purchaseUser(false);
  const course = await purchaseCourse(slug, user?.id ?? null);
  if (!course) notFound();
  const lesson = course.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
  if (!lesson) notFound();
  if (!course.owned && !lesson.preview)
    redirect(`/courses/${course.slug}?message=purchase-to-unlock`);
  if (!localDemoEnabled()) return <LearningWorkspace slug={slug} initialLesson={lessonId} />;
  const content = await purchaseLesson(lessonId, user?.id ?? null);
  return <PurchasePlayer key={lessonId} course={course} lesson={content} />;
}
