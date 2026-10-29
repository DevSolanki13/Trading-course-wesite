import Link from "next/link";
import type { Course } from "../content/courses";
import { courses, formatPrice } from "../content/courses";
import { CourseArtwork } from "../components/course-artwork";
import { CourseCard } from "../components/course-card";
import { PreviewDialog } from "../components/preview-dialog";
import { Faq } from "../components/faq";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock,
  BookOpen,
  LockSimple,
  Plus,
  ShieldCheck,
} from "../components/icons";

export default function CourseDetailPage({ course }: { course: Course }) {
  return (
    <main id="main-content" className="course-detail">
      <div className="container">
        <Link className="back-link" href="/courses">
          <ArrowLeft size={16} />
          All courses
        </Link>
        <section className="course-detail-hero">
          <div>
            <div className="course-tags">
              <span>{course.level}</span>
              <span>Hindi lessons</span>
            </div>
            <h1>{course.title}</h1>
            <p className="detail-lead">{course.shortTitle}</p>
            <p className="muted">{course.summary}</p>
            <div className="course-meta">
              <span>
                <BookOpen size={17} />
                {course.lessons} lessons planned
              </span>
              <span>
                <Clock size={17} />
                {course.duration} illustrative duration
              </span>
            </div>
            <PreviewDialog courseSlug={course.slug} label="Preview the lesson format" />
          </div>
          <CourseArtwork kind={course.artwork} className="detail-artwork" />
        </section>
        <div className="detail-preview-note">
          <ShieldCheck size={19} />
          <p>
            Course preview: curriculum, lesson totals, durations and price are illustrative. The
            outlines below show selected example lessons. Final details and instructor identity are
            awaiting confirmation.
          </p>
        </div>
        <section className="mobile-course-info" aria-label="Course access and refund information">
          <h2>Your course access</h2>
          <p>
            Hindi lessons, lifetime online access and a private student community are planned. You
            can use two active devices.
          </p>
          <p>
            Seven-day refund window, with less than 10% watched.{" "}
            <Link href="/refund-policy">Read the full refund policy.</Link>
          </p>
        </section>
        <div className="detail-layout">
          <div>
            <section className="detail-section">
              <h2>What you’ll work on.</h2>
              <ul className="outcomes-list">
                {course.outcomes.map((outcome) => (
                  <li key={outcome}>
                    <Check size={19} />
                    {outcome}
                  </li>
                ))}
              </ul>
            </section>
            <section className="detail-section" id="curriculum">
              <h2>From concept to context.</h2>
              <p className="muted">
                Explore the proposed curriculum. Preview labels identify the planned free lessons;
                video recordings are not available yet.
              </p>
              <div className="curriculum-list">
                {course.modules.map((module, index) => (
                  <details key={module.title} open={index === 0}>
                    <summary>
                      <div>
                        <span className="module-index">
                          Module {String(index + 1).padStart(2, "0")}
                        </span>
                        <strong>{module.title}</strong>
                      </div>
                      <Plus size={20} />
                    </summary>
                    <ul>
                      {module.lessons.map((lesson) => (
                        <li key={lesson.title}>
                          {lesson.preview ? <BookOpen size={17} /> : <LockSimple size={17} />}
                          <span>{lesson.title}</span>
                          {lesson.preview && (
                            <span className="lesson-preview-tag">Preview planned</span>
                          )}
                          <time>{lesson.duration}</time>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </section>
            <section className="detail-section detail-audience">
              <div>
                <h2>Is this your next step?</h2>
                <p>{course.audience}</p>
              </div>
              <div>
                <h3>Before you begin</h3>
                <p>{course.prerequisites}</p>
              </div>
            </section>
            <section className="detail-section">
              <h2>Learn at your pace.</h2>
              <p>
                Hindi video lessons, a structured curriculum and lifetime online access are planned
                for each course. The educator’s biography and trailer will be published before
                enrolment opens.
              </p>
              <Link className="text-link" href="/about">
                More about the approach <ArrowUpRight size={17} />
              </Link>
            </section>
            <section className="detail-section">
              <h2>A few useful answers.</h2>
              <Faq compact />
            </section>
          </div>
          <aside className="purchase-panel">
            <span className="preview-price-label">Illustrative course price</span>
            <div className="detail-price">{formatPrice(course.price)}</div>
            <p className="purchase-tax-note">
              Final price and applicable GST will be confirmed before checkout.
            </p>
            <button className="button button-primary" disabled>
              Enrolment opens later
            </button>
            <span className="purchase-status">Purchases are disabled in this preview.</span>
            <ul className="purchase-includes">
              <li>
                <Check size={17} />
                Hindi video lessons
              </li>
              <li>
                <Check size={17} />
                Lifetime online access planned
              </li>
              <li>
                <Check size={17} />
                Resume across two active devices
              </li>
              <li>
                <Check size={17} />
                Private student community planned
              </li>
            </ul>
            <div className="purchase-refund">
              <ShieldCheck size={22} />
              <p>
                Seven-day refund window, with less than 10% watched.{" "}
                <Link href="/refund-policy">Read the full policy.</Link>
              </p>
            </div>
            <p className="purchase-risk">
              Educational content. No investment advice or guaranteed returns.
            </p>
          </aside>
        </div>
        <section className="section related-courses">
          <h2>Another way to keep learning.</h2>
          <div className="course-grid course-grid-two">
            {courses
              .filter((item) => item.slug !== course.slug)
              .map((item) => (
                <CourseCard key={item.slug} course={item} />
              ))}
          </div>
        </section>
      </div>
      <div className="mobile-purchase-bar">
        <div>
          <small>Illustrative price</small>
          <strong>{formatPrice(course.price)}</strong>
        </div>
        <button className="button button-primary" disabled>
          Enrolment not open
        </button>
      </div>
    </main>
  );
}
