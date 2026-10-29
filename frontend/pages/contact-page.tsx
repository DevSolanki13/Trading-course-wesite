import Link from "next/link";
import { Faq } from "../components/faq";
import { ArrowUpRight, TelegramLogo, InstagramLogo } from "../components/icons";
import { site } from "../content/site";

export default function ContactPage() {
  return (
    <main id="main-content" className="container contact-page">
      <div className="page-intro">
        <h1>
          A question?
          <br />
          Let’s get you some clarity.
        </h1>
        <p>
          Course details, access, community or refunds. Here’s where to find the information you
          need.
        </p>
      </div>
      <div className="contact-grid">
        <section className="contact-details">
          <h2>Course & account support</h2>
          {site.supportEmail ? (
            <>
              <p>
                Include the course title and, if you have purchased, your order reference. Please
                never send passwords or payment credentials.
              </p>
              <a className="button button-primary" href={`mailto:${site.supportEmail}`}>
                Email support <ArrowUpRight size={18} />
              </a>
            </>
          ) : (
            <>
              <p>
                Our support contact will be published before enrolment opens. This preview does not
                accept purchases or collect support messages.
              </p>
              <span className="contact-pending">Support address awaiting confirmation</span>
            </>
          )}
          <h2>Find the community</h2>
          <div className="contact-socials">
            {site.telegramUrl ? (
              <a href={site.telegramUrl} target="_blank" rel="noreferrer">
                <TelegramLogo size={21} />
                Public Telegram <ArrowUpRight size={16} />
              </a>
            ) : (
              <p>
                <TelegramLogo size={21} />
                Telegram link coming soon
              </p>
            )}
            {site.instagramUrl ? (
              <a href={site.instagramUrl} target="_blank" rel="noreferrer">
                <InstagramLogo size={21} />
                Instagram <ArrowUpRight size={16} />
              </a>
            ) : (
              <p>
                <InstagramLogo size={21} />
                Instagram link coming soon
              </p>
            )}
          </div>
        </section>
        <section>
          <h2>Often, the answer is here.</h2>
          <Faq />
        </section>
      </div>
      <div className="contact-policy-links">
        <Link href="/refund-policy">
          Refund policy <ArrowUpRight size={16} />
        </Link>
        <Link href="/privacy">
          Privacy information <ArrowUpRight size={16} />
        </Link>
        <Link href="/disclaimer">
          Trading disclaimer <ArrowUpRight size={16} />
        </Link>
      </div>
    </main>
  );
}
