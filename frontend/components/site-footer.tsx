import Link from "next/link";
import { Brand } from "./site-header";
import { ArrowUpRight } from "./icons";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <Brand footer />
            <p>
              Less noise.
              <br />
              More understanding.
            </p>
          </div>
          <div className="footer-links">
            <div>
              <h2>Explore</h2>
              <Link href="/dashboard?view=explore">Explore courses</Link>
              <Link href="/about">Our approach</Link>
              <Link href="/contact">
                Contact <ArrowUpRight size={13} />
              </Link>
              <Link href="/contact#community">Community</Link>
            </div>
            <div>
              <h2>The details</h2>
              <Link href="/terms">Terms of use</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/refund-policy">Refund policy</Link>
              <Link href="/disclaimer">Trading disclaimer</Link>
            </div>
          </div>
        </div>
        <div className="risk-disclaimer">
          <p>
            For education, not investment advice. Trading involves risk and can result in the loss
            of capital. No outcome or return is guaranteed.
          </p>
          <p>
            All course content and curriculum are designed for educational trading methodology.
            Please review our refund and usage terms before enrolling.
          </p>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} indianXtrade. All rights reserved.</span>
          <span>Website in English. Lessons in Hindi.</span>
        </div>
      </div>
    </footer>
  );
}
