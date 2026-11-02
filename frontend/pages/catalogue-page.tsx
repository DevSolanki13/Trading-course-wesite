"use client";
import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/auth-provider";
import { courses as sampleCourses, type Course } from "../content/courses";
import { CourseCard } from "../components/course-card";
import { CourseArtwork } from "../components/course-artwork";
const CourseLearnersPanel = dynamic(() =>
  import("../components/admin/course-learners-panel").then((module) => module.CourseLearnersPanel),
);
import {
  ArrowDown,
  CalendarBlank,
  Clock,
  CurrencyInr,
  MagnifyingGlass,
  Rows,
  SquaresFour,
  Users,
} from "@phosphor-icons/react";

export default function CataloguePage({
  courses = sampleCourses,
  published = false,
  unavailable = false,
  isAdmin = false,
}: {
  courses?: Course[];
  published?: boolean;
  unavailable?: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const isAdminUser = isAdmin || user?.role === "admin";
  const [viewChoice, setViewMode] = useState<"horizontal" | "grid" | null>(null);
  const viewMode = viewChoice ?? (isAdminUser ? "horizontal" : "grid");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("All levels");
  const [learnersCourseId, setLearnersCourseId] = useState<string | null>(null);

  const levels = [...new Set(courses.map((course) => course.level))].sort();
  const results = courses.filter(
    (course) =>
      (level === "All levels" || course.level === level) &&
      `${course.title} ${course.summary}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <main id="main-content" className="container catalogue-page">
      {learnersCourseId && (
        <CourseLearnersPanel
          courseId={learnersCourseId}
          onBack={() => setLearnersCourseId(null)}
          onEdit={() => {
            router.push("/admin");
          }}
        />
      )}
      {!learnersCourseId && (
        <>
          <div className="page-intro">
            <h1>
              A clearer path
              <br />
              through the markets.
            </h1>
            <p>
              Start with the basics, explore price action, or focus on the decisions behind the
              trade. Find a course that fits your next step.
            </p>
          </div>
          <div className="catalogue-toolbar">
            <div className="course-filter">
              <label htmlFor="course-level">Your starting point</label>
              <select id="course-level" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option>All levels</option>
                {levels.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="course-search">
              <MagnifyingGlass size={20} />
              <label className="sr-only" htmlFor="course-search">
                Search courses
              </label>
              <input
                id="course-search"
                placeholder="Find a course"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="catalogue-results-heading">
            <div>
              <h2>{level === "All levels" ? "Explore the courses" : `${level} courses`}</h2>
              {isAdminUser && <span className="admin-view-indicator">Admin workspace mode</span>}
            </div>
            <div className="catalogue-heading-actions">
              <span aria-live="polite">
                {results.length} {results.length === 1 ? "course" : "courses"}{" "}
                <ArrowDown size={14} />
              </span>
              {isAdminUser && (
                <div className="admin-view-switcher" role="group" aria-label="Layout switcher">
                  <button
                    type="button"
                    className={`switcher-btn ${viewMode === "horizontal" ? "is-active" : ""}`}
                    onClick={() => setViewMode("horizontal")}
                    title="Horizontal layout (Admin)"
                  >
                    <Rows size={15} />
                    <span>Horizontal</span>
                  </button>
                  <button
                    type="button"
                    className={`switcher-btn ${viewMode === "grid" ? "is-active" : ""}`}
                    onClick={() => setViewMode("grid")}
                    title="Grid layout (Student preview)"
                  >
                    <SquaresFour size={15} />
                    <span>Grid</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          {unavailable && (
            <p role="alert" className="auth-error">
              Course information is temporarily unavailable. Please try again later.
            </p>
          )}
          {results.length ? (
            isAdminUser && viewMode === "horizontal" ? (
              <div className="admin-course-horizontal-list">
                {results.map((course) => {
                  const rawDate = course.created_at || course.updated_at;
                  const formattedDate = rawDate
                    ? new Date(rawDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "1 Nov 2026";
                  const validity = `${course.accessPeriod || 1} ${course.accessUnit || "months"}`;

                  return (
                    <article className="admin-course-horizontal-card" key={course.slug}>
                      <div className="admin-course-card-main-with-thumb">
                        <Link
                          href={`/courses/${course.slug}`}
                          className="admin-course-thumb-wrap"
                          tabIndex={-1}
                          title={`View ${course.title} details`}
                        >
                          {course.thumbnailUrl ? (
                            <Image
                              unoptimized
                              src={course.thumbnailUrl}
                              alt=""
                              width={110}
                              height={72}
                            />
                          ) : (
                            <CourseArtwork
                              kind={course.artwork}
                              className="admin-course-thumb-artwork"
                            />
                          )}
                        </Link>
                        <div className="admin-course-card-info">
                          <div className="admin-course-card-title-row">
                            <span className={`admin-badge status-${course.status || "published"}`}>
                              {course.status || "published"}
                            </span>
                            <Link
                              href={`/courses/${course.slug}`}
                              className="admin-course-card-title-link"
                            >
                              <strong className="admin-course-card-title">{course.title}</strong>
                            </Link>
                            <span className="admin-course-card-slug">/{course.slug}</span>
                          </div>
                          <p className="admin-course-card-desc">
                            {course.summary || course.shortTitle}
                          </p>
                        </div>
                      </div>

                      <div className="admin-course-card-col">
                        <span className="admin-course-col-label">
                          <CalendarBlank size={14} /> Date
                        </span>
                        <span className="admin-course-col-val">{formattedDate}</span>
                      </div>

                      <div className="admin-course-card-col">
                        <span className="admin-course-col-label">
                          <Clock size={14} /> Validity
                        </span>
                        <span className="admin-course-col-val">{validity}</span>
                      </div>

                      <div className="admin-course-card-col">
                        <span className="admin-course-col-label">
                          <CurrencyInr size={14} /> Price
                        </span>
                        <div className="admin-course-col-val admin-course-price">
                          <span>₹{course.price.toLocaleString("en-IN")}</span>
                        </div>
                      </div>

                      <div className="admin-course-card-actions">
                        <button
                          type="button"
                          className="button button-secondary button-sm"
                          onClick={() => setLearnersCourseId(course.id || course.slug)}
                          title="View enrolled learners"
                        >
                          <Users size={15} />
                          <span>Learners</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="course-grid">
                {results.map((course) => (
                  <CourseCard key={course.slug} course={course} />
                ))}
              </div>
            )
          ) : (
            <div className="empty-state">
              <MagnifyingGlass size={32} />
              <h2>No courses match that search.</h2>
              <p>Try a different topic or reset your filters.</p>
              <button
                className="button button-secondary"
                onClick={() => {
                  setQuery("");
                  setLevel("All levels");
                }}
              >
                Show all courses
              </button>
            </div>
          )}
          <p className="catalogue-note">
            {published
              ? "Published course information is shown for learning. Payments and final tax treatment remain unavailable in this preview."
              : "Preview catalogue. All curriculum, counts, durations and prices are illustrative. Final course information and tax treatment will be confirmed before enrolment opens."}
          </p>
        </>
      )}
    </main>
  );
}
