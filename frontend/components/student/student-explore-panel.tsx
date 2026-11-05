"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MagnifyingGlass,
  Check,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Clock,
  ShieldCheck,
  Play,
  LockSimple,
  GraduationCap,
  ListChecks,
} from "@phosphor-icons/react";
import { CourseArtwork } from "../course-artwork";
import { getCourse } from "../../content/courses";
import type { PurchaseCourse } from "../../../shared/purchase";

export interface StudentExplorePanelProps {
  exploreQuery: string;
  setExploreQuery: (q: string) => void;
  exploreLevel: string;
  setExploreLevel: (level: string) => void;
  availableLevels: string[];
  filteredExploreCourses: PurchaseCourse[];
  onSelectCoursesView: () => void;
  onOpenCourse: (slug: string, lessonId?: string | null) => void;
  initialSelectedCourseSlug?: string | null;
}

export function StudentExplorePanel({
  exploreQuery,
  setExploreQuery,
  exploreLevel,
  setExploreLevel,
  availableLevels,
  filteredExploreCourses,
  onSelectCoursesView,
  onOpenCourse,
  initialSelectedCourseSlug = null,
}: StudentExplorePanelProps) {
  const [selectedCourseSlug, setSelectedCourseSlug] = useState<string | null>(
    initialSelectedCourseSlug || null,
  );

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        setSelectedCourseSlug(params.get("course"));
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleOpenDetail = (slug: string) => {
    setSelectedCourseSlug(slug);
    if (typeof window !== "undefined") {
      window.history.pushState(
        null,
        "",
        `/dashboard?view=explore&course=${encodeURIComponent(slug)}`,
      );
    }
  };

  const handleBackToCatalog = () => {
    setSelectedCourseSlug(null);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/dashboard?view=explore");
    }
  };

  const selectedCourse = selectedCourseSlug
    ? filteredExploreCourses.find((c) => c.slug === selectedCourseSlug)
    : null;

  // =========================================================================
  // VIEW: COURSE DETAIL (Within Explore Courses Workspace)
  // =========================================================================
  if (selectedCourse) {
    const meta = getCourse(selectedCourse.slug);
    const priceInRupees = Math.round(selectedCourse.price / 100);
    const totalLessons = selectedCourse.modules.flatMap((m) => m.lessons).length;
    const totalDurationSeconds = selectedCourse.modules
      .flatMap((m) => m.lessons)
      .reduce((sum, l) => sum + (l.duration || 0), 0);
    const durHours = Math.floor(totalDurationSeconds / 3600);
    const durMins = Math.floor((totalDurationSeconds % 3600) / 60);
    const durationLabel =
      durHours > 0 ? `${durHours}h ${durMins}m` : durMins > 0 ? `${durMins}m` : "6h 30m";

    const previewLesson =
      selectedCourse.modules.flatMap((m) => m.lessons).find((l) => l.preview) ||
      selectedCourse.modules[0]?.lessons[0];

    const outcomes =
      meta?.outcomes && meta.outcomes.length
        ? meta.outcomes
        : [
            "Master stock market foundations and chart reading context",
            "Identify market trends, support & resistance levels accurately",
            "Learn high-probability price action entry and exit setups",
            "Develop strict risk management and disciplined execution",
          ];

    const audience =
      meta?.audience ||
      "Traders and learners who want a structured, disciplined, and rule-based trading method in Hindi.";

    const prerequisites =
      meta?.prerequisites ||
      "No prior trading experience required. An open mind and dedication to practice.";

    const isAdvancedLevel =
      selectedCourse.level?.toLowerCase() === "advanced" ||
      selectedCourse.slug.startsWith("advance-course");

    const prerequisiteList =
      meta?.prerequisiteList && meta.prerequisiteList.length
        ? meta.prerequisiteList
        : isAdvancedLevel
          ? [
              "Familiarity with basic candlestick anatomy (bullish/bearish bodies, wicks, pinbars)",
              "Understanding of market trends, swing highs/lows, and basic support & resistance levels",
              "Experience executing basic market orders and setting protective stop-loss limits",
              "Readiness to transition from retail indicator noise to institutional order flow & liquidity logic",
            ]
          : [
              "No prior stock market or financial trading experience required — starts from ground zero",
              "A smartphone, tablet, or laptop with internet access to study charts and streaming lessons",
              "Free TradingView account (or your broker's charting terminal) to practice identifying price action",
              "Commitment to follow disciplined risk management, capital protection, and pre-trade rules",
            ];

    const prerequisiteSummary = isAdvancedLevel
      ? "Basic Candlesticks & Support/Resistance"
      : "None required (Beginner-friendly)";

    const artworkKind =
      selectedCourse.slug.includes("advance-course") || selectedCourse.slug.includes("price")
        ? "structure"
        : selectedCourse.slug.includes("risk")
          ? "risk"
          : "foundations";

    return (
      <div className="student-explore-detail-wrapper">
        {/* Navigation Breadcrumb & Back Action */}
        <div className="student-explore-detail-nav">
          <button
            type="button"
            className="student-explore-back-btn"
            onClick={handleBackToCatalog}
            aria-label="Back to explore courses list"
          >
            <ArrowLeft size={16} />
            <span>Back to explore courses</span>
          </button>
          <div className="student-explore-breadcrumb">
            <span onClick={handleBackToCatalog} style={{ cursor: "pointer" }}>
              Explore courses
            </span>
            <span className="sep">/</span>
            <strong>{selectedCourse.title}</strong>
          </div>
        </div>

        {/* Hero Header Banner */}
        <div className="student-explore-detail-hero">
          <div className="student-explore-detail-tags">
            <span className="student-explore-level-badge">{selectedCourse.level}</span>
            <span className="student-badge-pill">Hindi audio & notes</span>
            <span className="student-badge-pill">
              {selectedCourse.accessPeriod} {selectedCourse.accessUnit} full access
            </span>
            <span className="student-badge-pill">
              Prerequisites: {prerequisiteSummary}
            </span>
          </div>

          <h1 className="student-explore-detail-title">{selectedCourse.title}</h1>
          <p className="student-explore-detail-desc">{selectedCourse.description}</p>

          <div className="student-explore-detail-meta-row">
            <span>
              <BookOpen size={16} />
              <strong>{totalLessons}</strong> lessons
            </span>
            <span>
              <Clock size={16} />
              <strong>{durationLabel}</strong> duration
            </span>
            <span>
              <ShieldCheck size={16} />
              <strong>7-day</strong> refund protected
            </span>
          </div>
        </div>

        {/* Two-Column Responsive Layout */}
        <div className="student-explore-detail-grid">
          {/* Main Content (Left) */}
          <div className="student-explore-detail-main">
            {/* What you'll learn */}
            <div className="student-detail-card">
              <div className="student-detail-card-head">
                <GraduationCap size={22} color="var(--accent, #00df8f)" />
                <div>
                  <h3>What you’ll master in this course</h3>
                  <p className="student-detail-subtext">
                    Core principles and practical execution strategies covered in this curriculum
                  </p>
                </div>
              </div>
              <ul className="student-detail-outcomes-list">
                {outcomes.map((item, idx) => (
                  <li key={idx}>
                    <CheckCircle size={18} weight="fill" color="var(--accent, #00df8f)" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Course Prerequisites & Requirements Card */}
            <div className="student-detail-card">
              <div className="student-detail-card-head">
                <ListChecks size={22} color="var(--accent, #00df8f)" />
                <div>
                  <h3>Course Prerequisites & Requirements</h3>
                  <p className="student-detail-subtext">
                    What you should know or prepare before starting this curriculum
                  </p>
                </div>
              </div>
              <ul className="student-detail-outcomes-list">
                {prerequisiteList.map((item, idx) => (
                  <li key={idx}>
                    <CheckCircle size={18} weight="fill" color="var(--accent, #00df8f)" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Course Curriculum */}
            <div className="student-detail-card">
              <div className="student-detail-card-head">
                <BookOpen size={22} color="var(--accent, #00df8f)" />
                <div>
                  <h3>Course Curriculum</h3>
                  <p className="student-detail-subtext">
                    {selectedCourse.modules.length} modules · {totalLessons} lessons · All in Hindi
                  </p>
                </div>
              </div>

              <div className="student-curriculum-modules">
                {selectedCourse.modules.map((m, mIdx) => (
                  <div className="student-curriculum-module" key={m.id || mIdx}>
                    <div className="student-curriculum-module-head">
                      <div>
                        <span className="student-curriculum-module-num">Module {mIdx + 1}</span>
                        <h4 className="student-curriculum-module-title">{m.title}</h4>
                      </div>
                      <span className="student-curriculum-lesson-count">
                        {m.lessons.length} {m.lessons.length === 1 ? "lesson" : "lessons"}
                      </span>
                    </div>

                    <div className="student-curriculum-lessons-list">
                      {m.lessons.map((lesson, lIdx) => {
                        const min = Math.floor(lesson.duration / 60);
                        const sec = String(lesson.duration % 60).padStart(2, "0");
                        const durStr = `${min}:${sec}`;

                        return (
                          <div
                            className={`student-curriculum-lesson-item ${lesson.preview ? "is-preview-playable" : ""}`}
                            key={lesson.id || lIdx}
                            onClick={() => {
                              if (lesson.preview) {
                                onOpenCourse(selectedCourse.slug, lesson.id);
                              }
                            }}
                            style={lesson.preview ? { cursor: "pointer" } : undefined}
                            role={lesson.preview ? "button" : undefined}
                            tabIndex={lesson.preview ? 0 : undefined}
                            onKeyDown={(e) => {
                              if (lesson.preview && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                onOpenCourse(selectedCourse.slug, lesson.id);
                              }
                            }}
                          >
                            <div className="student-curriculum-lesson-info">
                              {lesson.preview ? (
                                <Play size={16} weight="fill" color="var(--accent, #00df8f)" />
                              ) : (
                                <LockSimple size={16} color="var(--muted, #8b949e)" />
                              )}
                              <span className="student-curriculum-lesson-title">
                                {lesson.title}
                              </span>
                              {lesson.preview && (
                                <span className="student-preview-pill">Free preview</span>
                              )}
                            </div>
                            <span className="student-curriculum-lesson-dur">{durStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audience & Overview */}
            <div className="student-detail-card">
              <div className="student-detail-two-col">
                <div>
                  <h4>Who this course is for</h4>
                  <p>{audience}</p>
                </div>
                <div>
                  <h4>Before you begin</h4>
                  <p>{prerequisites}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar / Sticky Enrollment Card (Right) */}
          <div className="student-explore-detail-sidebar">
            <div className="student-enroll-card">
              <div className="student-enroll-thumb">
                {selectedCourse.thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={selectedCourse.thumbnail} alt={selectedCourse.title} />
                ) : (
                  <CourseArtwork kind={artworkKind} />
                )}
              </div>

              <div className="student-enroll-body">
                <div className="student-enroll-pricing">
                  <span className="student-enroll-price-label">Program Enrollment</span>
                  <div className="student-enroll-price-val">
                    ₹{priceInRupees.toLocaleString("en-IN")}
                    <span className="student-enroll-tax-hint">One-time payment · Full access</span>
                  </div>
                </div>

                <div className="student-enroll-actions">
                  {selectedCourse.owned ? (
                    <button
                      type="button"
                      className="button button-secondary"
                      style={{ width: "100%", justifyContent: "center", padding: "14px" }}
                      onClick={() => {
                        onSelectCoursesView();
                        const firstLesson =
                          selectedCourse.modules.flatMap((m) => m.lessons).find((l) => !l.completed) ||
                          selectedCourse.modules[0]?.lessons[0];
                        onOpenCourse(selectedCourse.slug, firstLesson?.id || null);
                      }}
                    >
                      <CheckCircle size={18} color="var(--accent, #00df8f)" />
                      <span>Enrolled · Open classroom</span>
                    </button>
                  ) : (
                    <>
                      <Link
                        className="button button-primary"
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          padding: "14px 18px",
                          fontSize: "15px",
                          fontWeight: 650,
                        }}
                        href={`/checkout/${selectedCourse.slug}`}
                      >
                        <span>Enroll now · ₹{priceInRupees.toLocaleString("en-IN")}</span>
                        <ArrowRight size={17} />
                      </Link>
                      {previewLesson && (
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{
                            width: "100%",
                            justifyContent: "center",
                            padding: "12px 16px",
                            fontSize: "14px",
                            fontWeight: 600,
                            marginTop: "8px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                          onClick={() => onOpenCourse(selectedCourse.slug, previewLesson.id)}
                        >
                          <Play size={15} weight="fill" />
                          <span>Watch a free lesson</span>
                        </button>
                      )}
                    </>
                  )}
                </div>

                <ul className="student-enroll-features-list">
                  <li>
                    <Check size={16} color="var(--accent, #00df8f)" />
                    <span>
                      Full access for {selectedCourse.accessPeriod} {selectedCourse.accessUnit}
                    </span>
                  </li>
                  <li>
                    <Check size={16} color="var(--accent, #00df8f)" />
                    <span>
                      {totalLessons} detailed lessons across {selectedCourse.modules.length} modules
                    </span>
                  </li>
                  <li>
                    <Check size={16} color="var(--accent, #00df8f)" />
                    <span>Hindi audio instruction & worked chart examples</span>
                  </li>
                  <li>
                    <Check size={16} color="var(--accent, #00df8f)" />
                    <span>Prerequisites: {prerequisiteSummary}</span>
                  </li>
                  <li>
                    <Check size={16} color="var(--accent, #00df8f)" />
                    <span>Instant access upon payment confirmation</span>
                  </li>
                  <li>
                    <Check size={16} color="var(--accent, #00df8f)" />
                    <span>7-day refund policy protection</span>
                  </li>
                </ul>

                <div className="student-enroll-trust-badge">
                  <LockSimple size={14} color="var(--muted, #8b949e)" />
                  <span>256-bit encrypted checkout via Cashfree</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: CATALOGUE GRID (Default Explore View)
  // =========================================================================
  return (
    <div>
      <div className="student-greeting-head">
        <div>
          <h1>Explore courses</h1>
          <p>Discover structured trading programs, candlestick analysis, and risk management.</p>
        </div>
      </div>

      {/* Search & Level Filter Bar */}
      <div className="student-search-bar-row">
        <div className="student-search-input-wrap">
          <MagnifyingGlass size={18} className="student-search-icon" />
          <input
            type="text"
            value={exploreQuery}
            onChange={(e) => setExploreQuery(e.target.value)}
            placeholder="Search courses"
            aria-label="Search courses"
          />
        </div>
        <select
          value={exploreLevel}
          onChange={(e) => setExploreLevel(e.target.value)}
          aria-label="Filter courses by difficulty level"
        >
          <option value="all">All levels</option>
          {availableLevels.map((lvl) => (
            <option key={lvl.toLowerCase()} value={lvl.toLowerCase()}>
              {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Courses Catalogue Grid */}
      {filteredExploreCourses.length ? (
        <div className="student-course-grid">
          {filteredExploreCourses.map((c) => {
            const isOwned = c.owned;
            const priceInRupees = Math.round(c.price / 100);
            const artworkKind =
              c.slug.includes("advance-course") || c.slug.includes("price")
                ? "structure"
                : c.slug.includes("risk")
                  ? "risk"
                  : "foundations";

            return (
              <article className="student-explore-card" key={c.id}>
                <div
                  className="student-explore-card-thumb"
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    isOwned
                      ? (() => {
                          onSelectCoursesView();
                          const firstLesson =
                            c.modules.flatMap((m) => m.lessons).find((l) => !l.completed) ||
                            c.modules[0]?.lessons[0];
                          onOpenCourse(c.slug, firstLesson?.id || null);
                        })()
                      : handleOpenDetail(c.slug)
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleOpenDetail(c.slug);
                  }}
                  aria-label={`View details for ${c.title}`}
                >
                  {c.thumbnail ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={c.thumbnail} alt={c.title} />
                  ) : (
                    <CourseArtwork kind={artworkKind} />
                  )}
                  <span className="student-explore-price-tag">
                    ₹{priceInRupees.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="student-explore-card-body">
                  <span className="student-explore-level-badge">{c.level}</span>
                  <h4
                    style={{ cursor: "pointer" }}
                    onClick={() => handleOpenDetail(c.slug)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleOpenDetail(c.slug);
                    }}
                  >
                    {c.title}
                  </h4>
                  <p>{c.description}</p>

                  <ul className="student-explore-features">
                    <li>
                      <Check size={14} color="var(--accent, #00df8f)" />
                      <span>
                        {c.accessPeriod} {c.accessUnit} full access
                      </span>
                    </li>
                    <li>
                      <Check size={14} color="var(--accent, #00df8f)" />
                      <span>{c.modules.flatMap((m) => m.lessons).length} detailed lessons</span>
                    </li>
                    <li>
                      <Check size={14} color="var(--accent, #00df8f)" />
                      <span>Hindi audio instruction & notes</span>
                    </li>
                    <li>
                      <Check size={14} color="var(--accent, #00df8f)" />
                      <span>
                        Prerequisites:{" "}
                        {c.level?.toLowerCase() === "advanced" ||
                        c.slug.startsWith("advance-course")
                          ? "Basic Candlesticks & S/R"
                          : "None (Beginner-friendly)"}
                      </span>
                    </li>
                  </ul>

                  <div className="student-explore-card-footer">
                    {isOwned ? (
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={() => {
                          onSelectCoursesView();
                          const firstLesson =
                            c.modules.flatMap((m) => m.lessons).find((l) => !l.completed) ||
                            c.modules[0]?.lessons[0];
                          onOpenCourse(c.slug, firstLesson?.id || null);
                        }}
                      >
                        <CheckCircle size={16} color="var(--accent, #00df8f)" />
                        <span>Enrolled · Open course</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button-primary"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={() => handleOpenDetail(c.slug)}
                      >
                        <span>View course & enroll</span>
                        <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="student-empty-state">
          <h3>No courses match your query</h3>
          <p>Try searching with different terms or reset the level filter.</p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              setExploreQuery("");
              setExploreLevel("all");
            }}
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
