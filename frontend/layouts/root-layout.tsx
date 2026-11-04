import "@fontsource-variable/manrope";
import "@fontsource-variable/fraunces";
import "@fontsource/ibm-plex-mono/400.css";
import "../styles/globals.css";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { PurchaseToaster } from "../components/purchase-toaster";
import { AuthProvider } from "../components/auth-provider";
import "../styles/purchase.css";
import "../styles/brand.css";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="app-shell">
        <SiteHeader />
        <div className="app-main-viewport">
          <div className="site-header-spacer" aria-hidden="true" />
          {children}
          <SiteFooter />
        </div>
      </div>
      <PurchaseToaster />
    </AuthProvider>
  );
}
