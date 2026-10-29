import { notFound } from "next/navigation";
import { courses, getCourse } from "@/frontend/content/courses";
import CourseDetailPage from "@/frontend/pages/course-detail-page";
import { pageMetadata } from "@/frontend/lib/metadata";
export function generateStaticParams() {
  return courses.map((course) => ({ slug: course.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = getCourse(slug);
  return course ? pageMetadata(course.title, course.summary, `/courses/${slug}`) : {};
}
export default async function CourseRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();
  return <CourseDetailPage course={course} />;
}
