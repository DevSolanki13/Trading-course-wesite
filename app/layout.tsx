import type { Metadata } from "next";
import { headers } from "next/headers";
import RootLayout from "@/frontend/layouts/root-layout";
import { site } from "@/frontend/content/site";
import { siteOrigin } from "@/frontend/lib/metadata";
export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: {
    default: "GlobalBulls | Learn the process. Respect the risk.",
    template: "%s | GlobalBulls",
  },
  description: site.description,
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
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('market-method-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body>
        <RootLayout>{children}</RootLayout>
      </body>
    </html>
  );
}
