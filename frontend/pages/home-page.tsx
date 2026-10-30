import Link from "next/link";
import Image from "next/image";
import { CourseCard } from "../components/course-card";
import { PreviewDialog } from "../components/preview-dialog";
import { RiskExercise } from "../components/risk-exercise";
import { Faq } from "../components/faq";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ShieldCheck,
  TelegramLogo,
  InstagramLogo,
  Clock,
} from "../components/icons";
import { courses as sampleCourses, type Course } from "../content/courses";
import type { SiteDocument } from "../../shared/admin";
import { site } from "../content/site";
import "../styles/landing.css";

const learningSteps = [
  {
    title: "Start with understanding.",
    text: "Build a foundation in how markets work, before exploring how to participate.",
    label: "The foundations",
  },
  {
    title: "Put the chart in context.",
    text: "Move beyond isolated patterns. Explore structure, levels and what an example leaves out.",
    label: "The perspective",
  },
  {
    title: "Make room for reflection.",
    text: "Study risk, consider your decisions and develop a process you can review.",
    label: "The discipline",
  },
];

export default function HomePage({
  courses = sampleCourses,
  content = null,
  telegramUrl = site.telegramUrl,
  instagramUrl = site.instagramUrl,
  published = false,
}: {
  courses?: Course[];
  content?: SiteDocument | null;
  telegramUrl?: string | null;
  instagramUrl?: string | null;
  published?: boolean;
}) {
  return (
    <main id="main-content" className="landing-page">
      <section className="landing-hero container" aria-labelledby="landing-title">
        <div className="market-structure-bg" aria-hidden="true">
          <svg viewBox="0 0 720 520" role="presentation">
            <defs>
              <linearGradient id="market-line" x1="0" x2="1">
                <stop offset="0" stopColor="currentColor" stopOpacity="0" />
                <stop offset="0.45" stopColor="currentColor" stopOpacity="0.7" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g className="market-grid"><path d="M0 100H720M0 210H720M0 320H720M0 430H720" /><path d="M110 0V520M260 0V520M410 0V520M560 0V520" /></g>
            <path className="market-path" d="M0 377C76 352 92 392 148 330S226 274 279 311s71-29 112-74 67 23 103-14 68-50 98-35 51-63 128-116" />
            <g className="market-candles"><path d="M106 350v-94m-14 48h28M188 315v-112m-14 61h28M302 291v-86m-14 38h28M421 234v-118m-14 62h28M538 182v-92m-14 42h28M646 121V38m-14 42h28" /></g>
          </svg>
        </div>
        <div className="landing-hero-copy">
          <div className="landing-subject">
            <BookOpen size={16} />
            <span>Trading education. In Hindi.</span>
          </div>
          <h1 id="landing-title">
            <span className="landing-hero-line">{content?.heroTitle || "Clarity before"}</span>
            <br />
            <span className="landing-hero-line">{content?.heroAccent || "the first trade."}</span>
          </h1>
          <p>
            {content?.heroDescription ||
              "Understand the market, not just the chart. A structured learning path through foundations, price action and risk."}
          </p>
          <div className="landing-actions">
            <Link href="/courses" className="button button-primary">
              Explore courses <ArrowUpRight size={19} />
            </Link>
            {courses[0]?.previewLessonId ? (
              <Link
                className="button button-secondary"
                href={`/learn/${courses[0].slug}?lesson=${courses[0].previewLessonId}`}
              >
                Watch a free lesson
              </Link>
            ) : (
              <PreviewDialog />
            )}
          </div>
          <div className="landing-hero-meta">
            <span>
              <Check size={16} />
              Learn at your pace
            </span>
            <span>
              <BookOpen size={16} />
              Hindi lessons
            </span>
          </div>
        </div>
        <aside className="learning-path" aria-label="Explore the preview learning path">
          <div className="learning-path-top">
            <span className="learning-path-icon">
              <BookOpen size={23} />
            </span>
            <span className="learning-path-state">Preview syllabus</span>
          </div>
          <div className="learning-path-heading">
            <h2>
              Your next chapter
              <br />
              starts with the basics.
            </h2>
            <p>{courses.length} subjects. One considered approach.</p>
          </div>
          <nav aria-label="Learning path courses">
            {courses.map((course, index) => (
              <Link
                key={course.slug}
                href={`/courses/${course.slug}`}
                className="learning-path-row"
              >
                <span className="learning-path-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="learning-path-row-copy">
                  <strong>{course.title}</strong>
                  <span>
                    {course.level} <span aria-hidden="true">/</span> {course.duration}
                  </span>
                </span>
                <ArrowUpRight size={18} />
              </Link>
            ))}
          </nav>
          <div className="learning-path-foot">
            <ShieldCheck size={16} />
            <span>Built around understanding. Grounded in risk.</span>
          </div>
        </aside>
      </section>

      <div className="landing-principles container">
        <div>
          <span className="principle-number">01</span>
          <span>Foundations before strategies</span>
        </div>
        <div>
          <span className="principle-number">02</span>
          <span>Context before a decision</span>
        </div>
        <div>
          <span className="principle-number">03</span>
          <span>Process before outcomes</span>
        </div>
      </div>

      <section
        className="landing-section landing-courses container"
        id="courses"
        aria-labelledby="course-heading"
      >
        <div className="landing-section-heading">
          <div>
            <span className="landing-section-label">The learning collection</span>
            <h2 id="course-heading">
              A focused place to start.
              <br />
              <span>Room to go deeper.</span>
            </h2>
          </div>
          <div>
            <p>
              Choose your starting point. Each course follows one subject, with a clear path through
              it.
            </p>
            <Link href="/courses" className="text-link">
              Explore the collection <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
        <div className="course-grid">
          {courses.map((course) => (
            <CourseCard key={course.slug} course={course} />
          ))}
        </div>
        <p className="catalogue-note">
          <ShieldCheck size={15} />
          {published
            ? "Published course details are shown. Payments remain unavailable; final prices and policies require approval."
            : "Preview collection. Curriculum, lesson counts, durations and prices are illustrative and awaiting instructor confirmation."}
        </p>
      </section>

      {content?.instructorConfirmed&&content.instructorName&&content.instructorBio&&<section className={`landing-instructor container ${content.instructorPortraitUrl?"landing-instructor-with-photo":""}`}><div className="landing-instructor-copy"><span className="landing-section-label">The person behind the lessons</span><h2>{content.instructorName}</h2><p>{content.instructorBio}</p><Link className="text-link" href="/about">Meet the instructor <ArrowUpRight size={18}/></Link></div>{content.instructorPortraitUrl&&<div className="landing-instructor-photo"><Image unoptimized fill sizes="(max-width: 800px) 100vw, 40vw" src={content.instructorPortraitUrl} alt={`${content.instructorName}, course instructor`}/></div>}</section>}

      <section className="landing-method container" aria-labelledby="method-heading">
        <div className="landing-method-intro">
          <span className="landing-section-label">A different starting point</span>
          <h2 id="method-heading">
            {content?.teachingTitle || "More than a setup."}
            <br />
            <span>A way to think.</span>
          </h2>
          <p>
            {content?.teachingDescription ||
              "A chart can show you a pattern. Understanding asks what surrounds it, what could go wrong, and what you can learn."}
          </p>
          <Link href="/about" className="text-link">
            Our approach to learning <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="landing-method-list">
          {learningSteps.map((step, index) => (
            <article key={step.label}>
              <span className="landing-method-index">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <span className="landing-method-label">{step.label}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-risk-section" aria-labelledby="risk-heading">
        <div className="container landing-risk-grid">
          <div className="landing-risk-copy">
            <span className="landing-section-label">Put an idea into practice</span>
            <h2 id="risk-heading">
              Give risk
              <br />
              <span>the first word.</span>
            </h2>
            <p>
              Before asking what a trade could make, understand what a hypothetical risk budget
              means. Change the values and see the arithmetic.
            </p>
            <div className="landing-risk-lesson">
              <span>
                <ShieldCheck size={23} />
              </span>
              <div>
                <strong>Understanding is the exercise.</strong>
                <p>These figures illustrate a calculation, not a recommendation for your money.</p>
              </div>
            </div>
            <Link href="/courses/risk-and-psychology" className="text-link">
              Explore risk & psychology <ArrowUpRight size={18} />
            </Link>
          </div>
          <RiskExercise />
        </div>
      </section>

      <section className="landing-community container" aria-labelledby="community-heading">
        <div>
          <span className="landing-section-label">Keep the conversation going</span>
          <h2 id="community-heading">
            Learning doesn’t
            <br />
            end at the lesson.
          </h2>
          <p>
            Public community channels for updates. A separate private group is planned for students
            who purchase a course.
          </p>
          <Link href="/contact" className="text-link">
            Community & support <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="landing-community-links">
          {[
            {
              name: "Telegram",
              detail: "The public channel",
              url: telegramUrl,
              Icon: TelegramLogo,
            },
            {
              name: "Instagram",
              detail: "Notes from the learning journey",
              url: instagramUrl,
              Icon: InstagramLogo,
            },
          ].map(({ name, detail, url, Icon }) =>
            url ? (
              <a href={url} key={name} target="_blank" rel="noreferrer" className="landing-social">
                <span className="landing-social-icon">
                  <Icon size={25} />
                </span>
                <span>
                  <strong>{name}</strong>
                  <small>{detail}</small>
                </span>
                <ArrowUpRight size={20} />
              </a>
            ) : (
              <div key={name} className="landing-social">
                <span className="landing-social-icon">
                  <Icon size={25} />
                </span>
                <span>
                  <strong>{name}</strong>
                  <small>{detail}</small>
                </span>
                <span className="landing-coming-soon">Coming soon</span>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="landing-faq container" aria-labelledby="faq-heading">
        <div>
          <span className="landing-section-label">A few useful answers</span>
          <h2 id="faq-heading">
            Clarity from
            <br />
            the beginning.
          </h2>
          <p>Language, access, refunds and everything you should know before choosing a course.</p>
          <Link href="/contact" className="text-link">
            Have another question? <ArrowUpRight size={18} />
          </Link>
        </div>
        <Faq items={content?.faqs?.length ? content.faqs : undefined} />
      </section>

      {!!content?.testimonials?.length && content.genuineTestimonialsConfirmed && (
        <section className="landing-testimonials container">
          <span className="landing-section-label">Learner perspectives</span>
          <h2>From people who learned with us.</h2>
          <div className="landing-testimonial-grid">
            {content.testimonials.map((item, index) => (
              <blockquote key={index}>
                <p>{item.quote}</p>
                <footer>
                  {item.name}
                  {item.course ? ` · ${item.course}` : ""}
                </footer>
              </blockquote>
            ))}
          </div>
          <p className="learning-caption">
            Individual experiences vary. No trading outcome is promised or implied.
          </p>
        </section>
      )}

      <section className="landing-close container">
        <div className="landing-close-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <span className="landing-section-label">Your learning journey starts here</span>
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
        <span className="landing-close-note">
          <Clock size={14} />
          Learn at your pace. In your own time.
        </span>
      </section>
    </main>
  );
}
