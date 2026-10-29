import "@fontsource-variable/manrope";
import "@fontsource/ibm-plex-mono/400.css";
import "../styles/globals.css";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
