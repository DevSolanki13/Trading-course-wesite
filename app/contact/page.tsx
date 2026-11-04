import { pageMetadata } from "@/frontend/lib/metadata";
export const metadata = pageMetadata(
  "Contact & support",
  "Find information about course access, refunds and the planned indianXtrade community.",
  "/contact",
);
import ContactPage from "@/frontend/pages/contact-page";
import { publicCatalog } from "@/backend/public/catalogue";
import { site } from "@/frontend/content/site";
export const dynamic = "force-dynamic";
export default async function Contact({
  searchParams,
}: {
  searchParams?: Promise<{ topic?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const data = await publicCatalog();
  return (
    <ContactPage
      supportEmail={data.supportEmail ?? site.supportEmail}
      telegramUrl={data.telegramUrl}
      instagramUrl={data.instagramUrl}
      content={data.content}
      topic={query.topic}
    />
  );
}
