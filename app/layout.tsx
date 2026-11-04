import type { Metadata } from "next";
import { headers } from "next/headers";
import RootLayout from "@/frontend/layouts/root-layout";
import { site } from "@/frontend/content/site";
import { siteOrigin } from "@/frontend/lib/metadata";
export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: {
    default: "indianXtrade | Learn the process. Respect the risk.",
    template: "indianXtrade | %s",
  },
  description: site.description,
  icons: {
    icon: [
      {
        url: "/favicon-dark.png",
        type: "image/png",
        sizes: "32x32",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/favicon-light.png",
        type: "image/png",
        sizes: "32x32",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon.ico",
        sizes: "any",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  robots:
    process.env.VERCEL_ENV === "production" && process.env.ALLOW_INDEXING === "true"
      ? { index: true, follow: true }
      : { index: false, follow: false },
};
export default async function Layout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('market-method-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;window.addEventListener('DOMContentLoaded',function(){var f=document.querySelectorAll('link[rel=\"icon\"]');f.forEach(function(el){el.href=t==='light'?'/favicon-light.png':'/favicon-dark.png';});});}}catch(e){}`,
          }}
        />
      </head>
      <body>
        <RootLayout>{children}</RootLayout>
      </body>
    </html>
  );
}
