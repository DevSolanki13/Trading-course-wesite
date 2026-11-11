import Link from "next/link";
import localFont from "next/font/local";
import { AnnotatedChart } from "../components/hero/AnnotatedChart";
import { TeacherNotes } from "../components/hero/TeacherNotes";
import { HeroAnnotations } from "../components/hero/HeroAnnotations";
import { DiwaliDecor, DiwaliGreeting } from "../components/hero/DiwaliDecor";
import { CourseCard } from "../components/course-card";
import { FloatingCardMarquee } from "../components/floating-card-marquee";
import { ProgressCandlestickChart } from "../components/progress-candlestick-chart";
import { Faq } from "../components/faq";
import { ArrowUpRight, ShieldCheck } from "../components/icons";
import { EnrollButton } from "../components/enroll-button";
import { courses as sampleCourses, type Course } from "../content/courses";
import type { SiteDocument } from "../../shared/admin";
import "../styles/landing.css";
import "../components/hero/hero-annotations.css";
import "../styles/hero-fonts.css";
import "../styles/diwali.css";

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
          Small steps today.
          <br />
          <span>Stronger habits</span> tomorrow.
        </h2>
        <p>
          You don’t need to know it all to begin. Start with curiosity, build with practice, and
          give yourself room to grow.
        </p>
      </div>
      <div className="stats-grid">
        <article className="stat-large">
          <div>
            <span className="card-label">START WHERE YOU ARE</span>
            <h3>{content?.teachingTitle || "Every expert was once a beginner."}</h3>
            <p>
              {content?.teachingDescription ||
                "One lesson. One chart. One better decision. Build the skills your future self will thank you for."}
            </p>
          </div>
          <ProgressCandlestickChart />
        </article>
        <article className="stat-practical">
          <span className="card-label">MAKE IT A HABIT</span>
          <h3>
            Consistency
            <br />
            beats intensity.
          </h3>
          <p>Learn a little. Practice with purpose. Repeat tomorrow.</p>
          <div className="mindset-rhythm" aria-hidden="true">
            <span>Learn</span>
            <i />
            <span>Practice</span>
            <i />
            <span>Repeat</span>
          </div>
        </article>
        <article className="stat-green">
          <span className="card-label">TRUST THE PROCESS</span>
          <h3>
            Keep
            <br />
            showing up.
          </h3>
          <p>
            Small steps. Stronger habits.
            <br />
            Your pace. Your progress.
          </p>
          <span className="card-arrow" aria-hidden="true">
            ↗
          </span>
        </article>
        <article className="stat-dark">
          <span className="card-label">GROW THROUGH THE PROCESS</span>
          <h3>
            A setback can be
            <br />a step forward.
          </h3>
          <p>
            A difficult session can still teach you something. Reflect, reset, and come back with a
            clearer plan.
          </p>
          <div className="mindset-return" aria-hidden="true">
            <span>Reflect</span>
            <i />
            <span>Reset</span>
            <i />
            <span>Return</span>
            <ArrowUpRight size={20} />
          </div>
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
  user = false,
}: {
  courses?: Course[];
  content?: SiteDocument | null;
  telegramUrl?: string | null;
  instagramUrl?: string | null;
  published?: boolean;
  unavailable?: boolean;
  user?: boolean;
}) {
  return (
    <main id="main-content" className="landing-page">
      <div
        className="ticker-strip"
        aria-label="Illustrative market values for education only, not live prices"
      >
        <div className="ticker-label-badge" aria-hidden="true">
          <span>Illustrative · Not live feed</span>
        </div>
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
      <section
        className="hero-modern hero-modern--diwali container"
        aria-labelledby="landing-title"
      >
        <DiwaliDecor />
        <DiwaliGreeting />
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
        <div className="eyebrow">INDIANXTRADE · TRADING EDUCATION</div>
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
          <EnrollButton initialLoggedIn={user} />
          <Link
            href={
              courses[0]?.previewLessonId
                ? `/learn/${courses[0].slug}?lesson=${courses[0].previewLessonId}`
                : "/dashboard?view=explore"
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
              <span>Two ways to begin.</span>
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
        <div className="eyebrow">WHY INDIANXTRADE</div>
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
        <Link
          className="button button-primary"
          href={
            user
              ? "/dashboard?view=explore"
              : `/login?next=${encodeURIComponent("/dashboard?view=explore")}`
          }
        >
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
