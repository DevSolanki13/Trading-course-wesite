import "@fontsource-variable/manrope";
import "@fontsource-variable/fraunces";
import "@fontsource/ibm-plex-mono/400.css";
import "../styles/globals.css";
import { GlobalSidebar } from "../components/global-sidebar";
import { SiteFooter } from "../components/site-footer";
import { PurchaseToaster } from "../components/purchase-toaster";
import { AuthProvider } from "../components/auth-provider";
import "../styles/purchase.css";
import "../styles/brand.css";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="app-shell">
        <GlobalSidebar />
        <div className="app-main-viewport">
          {children}
          <SiteFooter />
        </div>
      </div>
      <PurchaseToaster />
    </AuthProvider>
  );
}
