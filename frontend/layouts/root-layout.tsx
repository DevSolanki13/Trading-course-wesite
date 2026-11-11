import "@fontsource-variable/manrope";
import "@fontsource-variable/fraunces";
import "@fontsource/ibm-plex-mono/400.css";
import "../styles/globals.css";
import { PageBackLink, SiteHeader } from "../components/site-header";
import { HeaderLights } from "../components/header-lights";
import { SiteFooter } from "../components/site-footer";
import { PurchaseToaster } from "../components/purchase-toaster";
import { AuthProvider } from "../components/auth-provider";
import { FestivalVideoProvider } from "../components/festival-video";
import "../styles/purchase.css";
import "../styles/payment-gateway.css";
import "../styles/brand.css";
import "../styles/header-lights.css";
import "../styles/festival-video.css";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <FestivalVideoProvider>
        <div className="app-shell">
          <HeaderLights />
          <SiteHeader />
          <div className="app-main-viewport">
            <div className="site-header-spacer" aria-hidden="true" />
            <PageBackLink />
            {children}
            <SiteFooter />
          </div>
        </div>
        <PurchaseToaster />
      </FestivalVideoProvider>
    </AuthProvider>
  );
}
