import type { MetadataRoute } from "next";
import { siteOrigin } from "@/frontend/lib/metadata";
import { courses } from "@/frontend/content/courses";
import { publicCatalog } from "@/backend/public/catalogue";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await publicCatalog();
  return [
    "/",
    "/courses",
    "/about",
    "/contact",
    "/terms",
    "/privacy",
    "/refund-policy",
    "/disclaimer",
    ...(data.courses.length ? data.courses : courses).map((course) => `/courses/${course.slug}`),
  ].map((path) => ({ url: new URL(path, siteOrigin()).toString() }));
}
