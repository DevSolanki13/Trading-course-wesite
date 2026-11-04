import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Course lesson", robots: { index: false, follow: false } };

export default async function Lesson({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  redirect(
    `/dashboard?view=courses&course=${encodeURIComponent(slug)}&lesson=${encodeURIComponent(lessonId)}`,
  );
}
