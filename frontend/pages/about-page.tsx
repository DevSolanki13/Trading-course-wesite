import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "../components/icons";
import type { SiteDocument } from "../../shared/admin";

export default function AboutPage({ content = null }: { content?: SiteDocument | null }) {
  return (
    <main id="main-content" className="container about-page">
      <div className="page-intro">
        <h1>
          Built for understanding.
          <br />
          <span className="muted">Not for shortcuts.</span>
        </h1>
        <p>
          Market Method is a provisional trading-education brand with a simple point of view:
          learning a process matters more than collecting tips.
        </p>
      </div>
      <div className="about-image">
        <Image
          src="/images/study-desk.png"
          alt="Conceptual study desk with a notebook, pencil and glass shapes"
          fill
          sizes="(max-width: 768px) 100vw, 1200px"
        />
        <span>Room to think. Space to learn.</span>
      </div>
      <section className="about-body">
        <h2>
          A considered approach
          <br />
          to a complex subject.
        </h2>
        <div>
          <p>
            Trading can be complex. The proposed learning path starts with market foundations,
            introduces price action in context, and gives risk management its own place in the
            curriculum.
          </p>
          <p>
            Lessons will be in Hindi, supported by an English website and a clear module-by-module
            structure. Learning outcomes describe skills to study, not financial outcomes to expect.
          </p>
          {content?.instructorConfirmed && content.instructorName && content.instructorBio ? (
            <p>
              The course instructor is {content.instructorName}. {content.instructorBio}
            </p>
          ) : (
            <p>
              The instructor’s verified name, biography, experience and photograph have not yet been
              supplied. These will be published before the courses go on sale. We will not
              substitute invented credentials, ratings or learner results.
            </p>
          )}
          <Link href="/courses" className="button button-primary">
            Explore the learning path <ArrowUpRight size={19} />
          </Link>
        </div>
      </section>
      {content?.instructorConfirmed && content.instructorName && content.instructorBio && (
        <section className="about-instructor">
          <div>
            <span className="auth-section-label">Meet your instructor</span>
            <h2>{content.instructorName}</h2>
            <p>{content.instructorBio}</p>
          </div>
          {content.instructorPortraitUrl && (
            <div className="about-instructor-photo">
              <Image
                unoptimized
                fill
                sizes="(max-width: 768px) 100vw, 40vw"
                src={content.instructorPortraitUrl}
                alt={`${content.instructorName}, course instructor`}
              />
            </div>
          )}
        </section>
      )}
      <section className="about-principles">
        <article>
          <h3>Context over calls.</h3>
          <p>Education explains a way to think. It does not tell you what to buy or sell.</p>
        </article>
        <article>
          <h3>Process over promises.</h3>
          <p>Study how a decision is made, including its uncertainty and limitations.</p>
        </article>
        <article>
          <h3>Clarity over noise.</h3>
          <p>A focused curriculum, readable information and a transparent purchase experience.</p>
        </article>
      </section>
    </main>
  );
}
