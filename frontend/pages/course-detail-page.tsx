import Link from "next/link";
import Image from "next/image";
import type { Course } from "../content/courses";
import { courses, formatPrice } from "../content/courses";
import { CourseArtwork } from "../components/course-artwork";
import { CourseCard } from "../components/course-card";
import { PreviewDialog } from "../components/preview-dialog";
import { CourseAccessAction } from "../components/course-access-action";
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

export default function CourseDetailPage({
  course,
  relatedCourses,
  demoEnabled = false,
  paymentsUnavailable = false,
  purchaseNotice = false,
  expiryNotice = false,
  isAdmin = false,
}: {
  course: Course;
  relatedCourses?: Course[];
  demoEnabled?: boolean;
  paymentsUnavailable?: boolean;
  purchaseNotice?: boolean;
  expiryNotice?: boolean;
  isAdmin?: boolean;
}) {
  return (
    <main id="main-content" className="course-detail">
      <div className="container">
        {!isAdmin && purchaseNotice && (
          <p role="alert" className="auth-error">
            Purchase to unlock this lesson. You can try a free preview below.
          </p>
        )}
        {!isAdmin && expiryNotice && (
          <p role="alert" className="auth-error">
            Your course access has expired. Renew access to continue learning, or review your
            previous purchase from your dashboard.
          </p>
        )}
        <Link className="back-link" href="/dashboard?view=explore">
          <ArrowLeft size={16} />
          Explore courses
        </Link>
        <section className="course-detail-hero">
          <div>
            <div className="course-tags">
              <span>{course.level}</span>
              <span>Hindi lessons</span>
              {isAdmin && <span className="admin-badge status-published">Admin View</span>}
            </div>
            <h1>{course.title}</h1>
            <p className="detail-lead">{course.shortTitle}</p>
            <p className="muted">{course.summary}</p>
            <div className="course-meta">
              <span>
                <BookOpen size={17} />
                {course.lessons} lessons
              </span>
              <span>
                <Clock size={17} />
                {course.duration} {course.provisional === false ? "total" : "estimated"}
              </span>
            </div>
            {isAdmin ? (
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                <Link className="button button-primary" href={`/learn/${course.slug}`}>
                  Open course classroom
                </Link>
                <Link className="button button-secondary" href="/admin">
                  Edit in admin workspace
                </Link>
              </div>
            ) : course.previewLessonId ? (
              <Link
                className="button button-secondary"
                href={`/learn/${course.slug}?lesson=${course.previewLessonId}`}
              >
                Watch a free lesson
              </Link>
            ) : (
              <PreviewDialog courseSlug={course.slug} label="Preview the lesson format" />
            )}
          </div>
          {course.thumbnailUrl ? (
            <div className="detail-artwork-photo">
              <Image
                unoptimized
                fill
                priority
                sizes="(max-width: 900px) 100vw, 45vw"
                src={course.thumbnailUrl}
                alt={`${course.title} course cover`}
              />
            </div>
          ) : (
            <CourseArtwork kind={course.artwork} className="detail-artwork" />
          )}
        </section>
        <div className="detail-preview-note">
          <ShieldCheck size={19} />
          <p>
            {course.provisional === false
              ? demoEnabled
                ? "Published course curriculum and duration are verified. Demo checkout is enabled for testing."
                : "Published course curriculum and verified duration."
              : "Course preview: curriculum, lesson totals and price are for preview purposes."}
          </p>
        </div>
        <section className="mobile-course-info" aria-label="Course access and refund information">
          <h2>Your course access</h2>
          <p>
            Hindi lessons, online access for the period shown at checkout and a private student
            community are planned. Device limits and eligibility follow the active account policy.
          </p>
          <p>
            Refund eligibility follows the active policy and the terms saved with your purchase.{" "}
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
                {course.provisional === false
                  ? "Explore the course curriculum. Lessons marked with Free preview can be watched before purchasing."
                  : "Explore the proposed curriculum. Preview labels identify free lessons."}
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
                            <span className="lesson-preview-tag">
                              {course.provisional === false ? "Free preview" : "Preview planned"}
                            </span>
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
                {course.provisional === false
                  ? "Hindi video lessons, structured curriculum modules, and online access for the duration selected at checkout."
                  : "Hindi video lessons, structured curriculum modules, and online access."}
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
            {isAdmin ? (
              <>
                <span className="admin-badge status-published">Administrator Preview</span>
                <h3 style={{ fontSize: "20px", marginTop: "14px", marginBottom: "8px" }}>
                  Course Details & Access
                </h3>
                <p className="purchase-tax-note">
                  You are viewing this course as an administrator. Full curriculum and video
                  playback access is enabled without purchasing.
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    marginBlock: "18px",
                  }}
                >
                  <Link className="button button-primary" href={`/learn/${course.slug}`}>
                    Open course classroom
                  </Link>
                  <Link className="button button-secondary" href="/admin">
                    Edit curriculum in admin
                  </Link>
                </div>
                <ul className="purchase-includes">
                  <li>
                    <Check size={17} />
                    Hindi video lessons
                  </li>
                  <li>
                    <Check size={17} />
                    {course.accessPeriod ?? 1}{" "}
                    {(course.accessUnit ?? "months") === "months"
                      ? course.accessPeriod === 1 || !course.accessPeriod
                        ? "month"
                        : "months"
                      : course.accessPeriod === 1
                        ? "day"
                        : "days"}{" "}
                    of online access configured
                  </li>
                  <li>
                    <Check size={17} />
                    {course.lessons} lessons across {course.modules.length} modules
                  </li>
                  <li>
                    <Check size={17} />
                    Configured price: {formatPrice(course.price)}
                  </li>
                </ul>
              </>
            ) : (
              <>
                <span className="preview-price-label">
                  {course.provisional === false
                    ? course.price === 0
                      ? "Free course"
                      : "Course price"
                    : "Illustrative course price"}
                </span>
                <div className="detail-price">
                  {course.price === 0 ? "Free" : formatPrice(course.price)}
                </div>
                {course.price > 0 && (
                  <p className="purchase-tax-note">
                    Final price and applicable GST will be confirmed before checkout.
                  </p>
                )}
                <CourseAccessAction
                  slug={course.slug}
                  previewId={course.previewLessonId}
                  demoEnabled={demoEnabled}
                  courseId={course.id}
                  price={course.price}
                  paymentsUnavailable={paymentsUnavailable}
                />
                {course.price > 0 && (
                  <span className="purchase-status">
                    {demoEnabled
                      ? "Complete checkout to add this course to your dashboard."
                      : "Purchases are disabled in this preview."}
                  </span>
                )}
                <ul className="purchase-includes">
                  <li>
                    <Check size={17} />
                    Hindi video lessons
                  </li>
                  <li>
                    <Check size={17} />
                    {course.accessPeriod ?? 1}{" "}
                    {(course.accessUnit ?? "months") === "months"
                      ? course.accessPeriod === 1 || !course.accessPeriod
                        ? "month"
                        : "months"
                      : course.accessPeriod === 1
                        ? "day"
                        : "days"}{" "}
                    of online access
                  </li>
                  <li>
                    <Check size={17} />
                    Single active stream (up to two registered devices)
                  </li>
                  <li>
                    <Check size={17} />
                    Student mentorship &amp; community discussion
                  </li>
                </ul>
                {course.price > 0 && (
                  <div className="purchase-refund">
                    <ShieldCheck size={22} />
                    <p>
                      Eligible for refund according to our published policy before course completion
                      threshold. <Link href="/refund-policy">Read the full policy.</Link>
                    </p>
                  </div>
                )}
                <p className="purchase-risk">
                  Educational content. No investment advice or guaranteed returns.
                </p>
              </>
            )}
          </aside>
        </div>
        <section className="section related-courses">
          <h2>Another way to keep learning.</h2>
          <div className="course-grid course-grid-two">
            {(relatedCourses && relatedCourses.length > 0
              ? relatedCourses
              : courses.filter((item) => item.slug !== course.slug)
            )
              .slice(0, 2)
              .map((item) => (
                <CourseCard key={item.slug} course={item} />
              ))}
          </div>
        </section>
      </div>
      <div className="mobile-purchase-bar">
        <div>
          <small>
            {course.provisional === false
              ? course.price === 0
                ? "Free course"
                : "Course price"
              : "Illustrative price"}
          </small>
          <strong>{course.price === 0 ? "Free" : formatPrice(course.price)}</strong>
        </div>
        <CourseAccessAction
          slug={course.slug}
          courseId={course.id}
          mobile
          demoEnabled={demoEnabled}
          price={course.price}
          paymentsUnavailable={paymentsUnavailable}
        />
      </div>
    </main>
  );
}
