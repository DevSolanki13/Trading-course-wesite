import { notFound } from "next/navigation";
import { legalPages, type LegalSlug } from "@/frontend/content/legal";
import LegalPage from "@/frontend/pages/legal-page";
import { pageMetadata } from "@/frontend/lib/metadata";
export function generateStaticParams() {
  return Object.keys(legalPages).map((legal) => ({ legal }));
}
export async function generateMetadata({ params }: { params: Promise<{ legal: string }> }) {
  const { legal } = await params;
  return Object.prototype.hasOwnProperty.call(legalPages, legal)
    ? pageMetadata(
        legalPages[legal as LegalSlug].title,
        legalPages[legal as LegalSlug].intro,
        `/${legal}`,
      )
    : {};
}
export default async function LegalRoute({ params }: { params: Promise<{ legal: string }> }) {
  const { legal } = await params;
  if (!Object.prototype.hasOwnProperty.call(legalPages, legal)) notFound();
  return <LegalPage slug={legal as LegalSlug} />;
}
