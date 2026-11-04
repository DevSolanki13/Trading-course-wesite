import Link from "next/link";
import { Faq } from "../components/faq";
import { ArrowUpRight, TelegramLogo, InstagramLogo } from "../components/icons";
import { site } from "../content/site";
import type { SiteDocument } from "../../shared/admin";

export default function ContactPage({
  supportEmail = site.supportEmail,
  telegramUrl = site.telegramUrl,
  instagramUrl = site.instagramUrl,
  content = null,
  topic,
}: {
  supportEmail?: string | null;
  telegramUrl?: string | null;
  instagramUrl?: string | null;
  content?: SiteDocument | null;
  topic?: string;
}) {
  const topicDetails =
    topic === "learning"
      ? {
          label: "Course learning & mentor desk inquiry",
          subject: "[Learning Support] Question regarding course content",
          note: "Include your course title and lesson name so our team can provide tailored guidance.",
        }
      : topic === "refund" || topic === "billing"
        ? {
            label: "Billing & refund support",
            subject: "[Billing Support] Order reference inquiry",
            note: "Include your Order ID and the email address used at checkout for rapid reconciliation.",
          }
        : null;

  const mailtoSubject = topicDetails
    ? `?subject=${encodeURIComponent(topicDetails.subject)}`
    : `?subject=${encodeURIComponent(`[Support Inquiry] ${site.name}`)}`;

  const mailtoHref = supportEmail ? `mailto:${supportEmail}${mailtoSubject}` : "#";

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

      {topicDetails && (
        <div className="contact-topic-notice" role="status">
          <strong>Topic: {topicDetails.label}</strong>
          <p>{topicDetails.note}</p>
        </div>
      )}

      <div className="contact-grid">
        <section className="contact-details">
          <h2>Course & account support</h2>
          {supportEmail ? (
            <>
              <p>
                Include the course title and, if you have purchased, your order reference. Please
                never send passwords or payment credentials.
              </p>
              <a className="button button-primary" href={mailtoHref}>
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
          <h2>Business details</h2>
          <p>
            {site.name} is operated by {site.business.operator}.
            <br />
            {site.business.city}
            <br />
            Phone:{" "}
            <a href={`tel:${site.business.phone.replace(/\s/g, "")}`}>{site.business.phone}</a>
            {supportEmail ? (
              <>
                <br />
                Email: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
              </>
            ) : null}
          </p>
          <h2 id="community">Find the community</h2>
          <div className="contact-socials">
            {telegramUrl ? (
              <a href={telegramUrl} target="_blank" rel="noreferrer">
                <TelegramLogo size={21} />
                Public Telegram <ArrowUpRight size={16} />
              </a>
            ) : (
              <p>
                <TelegramLogo size={21} />
                Telegram link coming soon
              </p>
            )}
            {instagramUrl ? (
              <a href={instagramUrl} target="_blank" rel="noreferrer">
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
          <Faq items={content?.faqs?.length ? content.faqs : undefined} />
        </section>
      </div>
      <div className="contact-policy-links">
        <Link href="/terms">
          Terms and conditions <ArrowUpRight size={16} />
        </Link>
        <Link href="/refund-policy">
          Refund and cancellation policy <ArrowUpRight size={16} />
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
