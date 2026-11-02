import type { MetadataRoute } from "next";
import { siteOrigin } from "@/frontend/lib/metadata";

const indexingEnabled =
  process.env.VERCEL_ENV === "production" && process.env.ALLOW_INDEXING === "true";

export default function robots(): MetadataRoute.Robots {
  if (!indexingEnabled) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/dashboard", "/checkout", "/auth", "/account", "/pay"],
    },
    sitemap: new URL("/sitemap.xml", siteOrigin()).toString(),
  };
}
