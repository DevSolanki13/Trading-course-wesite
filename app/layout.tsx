import type { Metadata } from "next";
import RootLayout from "@/frontend/layouts/root-layout";
import { site } from "@/frontend/content/site";
import { siteOrigin } from "@/frontend/lib/metadata";
export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: {
    default: "Market Method | Learn the process. Respect the risk.",
    template: "%s | Market Method",
  },
  description: site.description,
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
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
