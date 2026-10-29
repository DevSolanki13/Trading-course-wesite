import type { MetadataRoute } from "next";
import { siteOrigin } from "@/frontend/lib/metadata";
import { courses } from "@/frontend/content/courses";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "/",
    "/courses",
    "/about",
    "/contact",
    "/terms",
    "/privacy",
    "/refund-policy",
    "/disclaimer",
    ...courses.map((course) => `/courses/${course.slug}`),
  ].map((path) => ({ url: new URL(path, siteOrigin()).toString() }));
}
