import { notFound } from "next/navigation";
import { getCourse } from "@/frontend/content/courses";
import CourseDetailPage from "@/frontend/pages/course-detail-page";
import { publicCatalog } from "@/backend/public/catalogue";
import { pageMetadata } from "@/frontend/lib/metadata";
import { isDemoPaymentEnabled } from "@/backend/payments/demo";
import { cashfreeSandboxEnabled } from "@/backend/payments/cashfree";
import { getPaymentProvider } from "@/backend/payments/providers";
export const dynamic = "force-dynamic";
export const dynamicParams = true;
async function find(slug: string) {
  const data = await publicCatalog();
  return data.courses.find((c) => c.slug === slug) ?? getCourse(slug);
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await find(slug);
  return course ? pageMetadata(course.title, course.summary, `/courses/${slug}`) : {};
}
export default async function CourseRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const course = await find(slug);
  if (!course) notFound();
  let enabled = false,
    unavailable = false;
  try {
    getPaymentProvider();
    enabled = true;
  } catch {
    unavailable = true;
  }
  return (
    <CourseDetailPage
      course={course}
      demoEnabled={
        course.provisional === false &&
        (enabled || isDemoPaymentEnabled() || cashfreeSandboxEnabled())
      }
      paymentsUnavailable={unavailable}
      purchaseNotice={(await searchParams).message === "purchase-to-unlock"}
    />
  );
}
