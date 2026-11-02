import Link from "next/link";
import localFont from "next/font/local";
import { AnnotatedChart } from "../components/hero/AnnotatedChart";
import { TeacherNotes } from "../components/hero/TeacherNotes";
import { HeroAnnotations } from "../components/hero/HeroAnnotations";
import { CourseCard } from "../components/course-card";
import { FloatingCardMarquee } from "../components/floating-card-marquee";
import { RiskExercise } from "../components/risk-exercise";
import { Faq } from "../components/faq";
import { ArrowRight, ArrowUpRight, ShieldCheck } from "../components/icons";
import { courses as sampleCourses, type Course } from "../content/courses";
import type { SiteDocument } from "../../shared/admin";
import "../styles/landing.css";
import "../components/hero/hero-annotations.css";
import "../styles/hero-fonts.css";

const annotationFont = localFont({
  src: "../assets/fonts/caveat-500-latin.woff2",
  weight: "500",
  style: "normal",
  variable: "--font-annotations",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Caveat Fallback"],
});
const headlineFont = localFont({
  src: [
    { path: "../assets/fonts/newsreader-500-latin.woff2", weight: "500", style: "normal" },
    { path: "../assets/fonts/newsreader-500-italic-latin.woff2", weight: "500", style: "italic" },
  ],
  variable: "--font-headline",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Newsreader Fallback"],
});

const ticker = ["NIFTY 50", "BANKNIFTY", "BTC/USD", "ETH/USD", "GOLD", "USD/INR"];
function StatsGrid({ content }: { content?: SiteDocument | null }) {
  return (
    <section className="about-section container" id="about" aria-labelledby="about-heading">
      <div className="eyebrow">• ABOUT US</div>
      <div className="about-heading">
        <h2 id="about-heading">
          A trading education built for <span>disciplined,</span> consistent practice.
        </h2>
        <p>
          Less noise. More context. A structured way to build the habits that last beyond a single
          setup.
        </p>
      </div>
      <div className="stats-grid">
        <article className="stat-large">
          <div>
            <span className="card-label">THE CURRICULUM</span>
            <h3>{content?.teachingTitle || "A considered trading education"}</h3>
            <p>
              {content?.teachingDescription ||
                "From market foundations to risk and psychology, learn at a pace that respects your process."}
            </p>
          </div>
          <div className="stat-chart" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </article>
        <article className="stat-practical">
          <span className="card-label">THE APPROACH</span>
          <h3>
            Process-led
            <br />
            learning
          </h3>
          <blockquote>Practical learning, careful review, and no promises of returns.</blockquote>
        </article>
        <article className="stat-green">
          <span className="card-label">THE WORK</span>
          <strong>Review</strong>
          <h3>
            Decisions analyzed
            <br />
            in context.
          </h3>
          <span className="card-arrow">↗</span>
        </article>
        <article className="stat-dark">
          <span className="card-label">THE SCOPE</span>
          <strong>Multiple</strong>
          <h3>Markets covered</h3>
          <p>Stocks · Forex · Crypto · Options</p>
          <div className="dark-wave" aria-hidden="true" />
        </article>
      </div>
    </section>
  );
}

export default function HomePage({
  courses = sampleCourses,
  content = null,
  published = false,
  unavailable = false,
}: {
  courses?: Course[];
  content?: SiteDocument | null;
  telegramUrl?: string | null;
  instagramUrl?: string | null;
  published?: boolean;
  unavailable?: boolean;
}) {
  return (
    <main id="main-content" className="landing-page">
      <div
        className="ticker-strip"
        aria-label="Illustrative market values for education only, not live prices"
      >
        <div className="ticker-track">
          {[...ticker, ...ticker].map((item, index) => (
            <span key={`${item}-${index}`} aria-hidden={index >= ticker.length}>
              <b>{item}</b>
              <em className={index % 3 === 0 ? "down" : "up"}>
                {index % 3 === 0 ? "−" : "+"}
                {(index % 3) + 1}.{index + 2}%
              </em>
            </span>
          ))}
        </div>
        <span className="sr-only">Illustrative values for education only. Not live prices.</span>
      </div>
      <section className="hero-modern container" aria-labelledby="landing-title">
        {unavailable && (
          <p role="alert" className="auth-error">
            Course information is temporarily unavailable. Please try again later.
          </p>
        )}
        <div className="hero-glow" aria-hidden="true" />
        <HeroAnnotations className={annotationFont.variable}>
          <AnnotatedChart />
          <TeacherNotes />
        </HeroAnnotations>
        <div className="eyebrow">GLOBALBULLS · TRADING EDUCATION</div>
        <h1 id="landing-title" className={headlineFont.variable}>
          {content?.heroTitle || "Learn to trade with"} <em>{content?.heroAccent || "clarity"}</em>
          <br />
          {content?.heroTitle ? "" : "and confidence."}
        </h1>
        <p className="hero-lede">
          {content?.heroDescription ||
            "Structured trading courses on price action, risk management and market psychology."}
        </p>
        <div className="hero-actions">
          <Link href="/courses" className="button button-primary">
            Enroll now <ArrowRight size={18} />
          </Link>
          <Link
            href={
              courses[0]?.previewLessonId
                ? `/learn/${courses[0].slug}?lesson=${courses[0].previewLessonId}`
                : "/courses"
            }
            className="button button-secondary"
          >
            View syllabus
          </Link>
        </div>
        <div className="trust-line">A structured, risk-aware place to start learning.</div>
        <FloatingCardMarquee />
      </section>
      <StatsGrid content={content} />
      <section className="landing-section landing-courses container" id="courses">
        <div className="section-heading">
          <div>
            <div className="eyebrow">THE LEARNING COLLECTION</div>
            <h2>
              One clear path.
              <br />
              <span>Three ways to begin.</span>
            </h2>
          </div>
          <p>
            Focused courses for wherever you are in your learning journey. No noise, no shortcuts.
          </p>
        </div>
        <div className="course-grid">
          {courses.slice(0, 3).map((course) => (
            <CourseCard key={course.slug} course={course} />
          ))}
        </div>
        <p className="catalogue-note">
          <ShieldCheck size={15} />{" "}
          {published
            ? "Published course details are shown. Trading involves risk."
            : "Preview collection. Course details and prices are illustrative."}
        </p>
      </section>
      <section className="why-section container" id="why">
        <div className="eyebrow">WHY GLOBALBULLS</div>
        <h2>
          Build a process
          <br />
          <span>you can trust.</span>
        </h2>
        <div className="why-grid">
          {[
            {
              n: "01",
              t: "Learn in context",
              d: "Understand the story behind the chart, not just the pattern in front of you.",
            },
            {
              n: "02",
              t: "Practice with purpose",
              d: "Work through real examples and exercises designed to sharpen your decisions.",
            },
            {
              n: "03",
              t: "Respect the risk",
              d: "Put position sizing, psychology and review at the centre of your process.",
            },
          ].map((item) => (
            <article key={item.n}>
              <b>{item.n}</b>
              <h3>{item.t}</h3>
              <p>{item.d}</p>
              <ArrowUpRight size={18} />
            </article>
          ))}
        </div>
      </section>
      <section className="landing-risk-section" aria-labelledby="risk-heading">
        <div className="container risk-modern">
          <div>
            <div className="eyebrow">PUT IT INTO PRACTICE</div>
            <h2 id="risk-heading">
              Risk gets
              <br />
              <span>the first word.</span>
            </h2>
            <p>
              Before asking what a trade could make, understand what a hypothetical risk budget
              means.
            </p>
            <Link
              href={`/courses/${courses.find((course) => course.slug === "risk-psychology" || course.slug === "risk-and-psychology")?.slug ?? "risk-and-psychology"}`}
              className="text-link"
            >
              Explore risk & psychology <ArrowUpRight size={18} />
            </Link>
          </div>
          <RiskExercise />
        </div>
      </section>
      {content?.genuineTestimonialsConfirmed && content.testimonials.length > 0 && (
        <section className="testimonials-modern container">
          <div className="eyebrow">LEARNER PERSPECTIVES</div>
          <h2>
            Quiet confidence
            <br />
            <span>speaks loudest.</span>
          </h2>
          <div className="testimonial-cards">
            {content.testimonials.map((item) => (
              <blockquote key={`${item.name}-${item.quote}`}>
                “{item.quote}”
                <footer>
                  — {item.name} · {item.course}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      )}
      <section className="landing-faq container" id="faq">
        <div>
          <div className="eyebrow">A FEW USEFUL ANSWERS</div>
          <h2>
            Clarity from
            <br />
            <span>the beginning.</span>
          </h2>
          <p>Language, access, refunds and everything you should know before choosing a course.</p>
          <Link href="/contact" className="text-link">
            Have another question? <ArrowUpRight size={18} />
          </Link>
        </div>
        <Faq items={content?.faqs?.length ? content.faqs : undefined} />
      </section>
      <section className="landing-close container">
        <div className="eyebrow">YOUR LEARNING JOURNEY STARTS HERE</div>
        <h2>
          Build your knowledge.
          <br />
          <span>Then build your process.</span>
        </h2>
        <p>
          No promised returns. No shortcuts.
          <br />
          Just a more considered place to start.
        </p>
        <Link className="button button-primary" href="/courses">
          Find your starting point <ArrowUpRight size={19} />
        </Link>
      </section>
      <p className="risk-disclaimer container">
        Trading involves risk. Course content is for education only. No outcome is promised or
        implied.
      </p>
    </main>
  );
}
