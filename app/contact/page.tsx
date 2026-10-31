import { pageMetadata } from "@/frontend/lib/metadata";
export const metadata = pageMetadata(
  "Contact & support",
  "Find information about course access, refunds and the planned Market Method community.",
  "/contact",
);
import ContactPage from "@/frontend/pages/contact-page";
import { publicCatalog } from "@/backend/public/catalogue";
export const dynamic = "force-dynamic";
export default async function Contact() {
  const data = await publicCatalog();
  return (
    <ContactPage
      supportEmail={data.supportEmail}
      telegramUrl={data.telegramUrl}
      instagramUrl={data.instagramUrl}
      content={data.content}
    />
  );
}
