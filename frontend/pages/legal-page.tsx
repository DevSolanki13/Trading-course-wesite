import Link from "next/link";
import { legalPages, type LegalSlug } from "../content/legal";
import { ArrowUpRight } from "../components/icons";

export default function LegalPage({ slug }: { slug: LegalSlug }) {
  const page = legalPages[slug];
  return (
    <main id="main-content" className="container legal-page">
      <header className="page-intro">
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
        <span className="legal-updated">Draft for owner review · 29 October 2026</span>
      </header>
      <div className="legal-layout">
        <nav aria-label="Policy navigation">
          {Object.entries(legalPages).map(([key, value]) => (
            <Link key={key} href={`/${key}`} aria-current={key === slug ? "page" : undefined}>
              {value.title}
              <ArrowUpRight size={14} />
            </Link>
          ))}
        </nav>
        <div className="legal-copy">
          {page.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
