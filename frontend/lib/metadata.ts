import type { Metadata } from "next";
import { site } from "../content/site";
export function siteOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}
export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title: { absolute: `${site.name} | ${title}` },
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${site.name} | ${title}`,
      description,
      url: path,
      siteName: site.name,
      type: "website",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "indianXtrade: Learn the process. Respect the risk.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${site.name} | ${title}`,
      description,
      images: ["/opengraph-image"],
    },
  };
}
