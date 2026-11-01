"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Books,
  Compass,
  Receipt,
  UserCircle,
  ArrowUUpLeft,
  CaretDown,
  PlayCircle,
  CheckCircle,
  Clock,
  MagnifyingGlass,
  Check,
  ArrowRight,
  ShieldCheck,
  Question,
  GraduationCap,
} from "@phosphor-icons/react";
import { BullMark } from "./bull-mark";
import { CourseArtwork } from "./course-artwork";
import { PurchasePlayer } from "./purchase-player";
import { ThemeToggle } from "./theme-toggle";
import type {
  PurchaseUser,
  PurchaseCourse,
  PurchaseOrder,
  PurchaseLessonContent,
} from "../../shared/purchase";
import { accessExpiryLabel } from "../../shared/course-access";

interface StudentDashboardProps {
  user: PurchaseUser;
  courses: PurchaseCourse[];
  allCourses?: PurchaseCourse[];
  orders: PurchaseOrder[];
  initialView?: "courses" | "explore" | "billing" | "account";
  ordersOnly?: boolean;
  local?: boolean;
  initialCourseSlug?: string;
  initialLessonId?: string;
}

export function StudentDashboard({
  user,
  courses,
  allCourses = [],
  orders,
  initialView = "courses",
  ordersOnly = false,
  local = false,
  initialCourseSlug,
  initialLessonId,
}: StudentDashboardProps) {
  const router = useRouter();
  const [view, setView] = useState<"courses" | "explore" | "billing" | "account">(
    ordersOnly ? "billing" : initialView,
  );
  const [courseFilter, setCourseFilter] = useState<"all" | "in_progress" | "completed">("all");
  const [exploreQuery, setExploreQuery] = useState("");
  const [exploreLevel, setExploreLevel] = useState("all");
  const [loggingOut, setLoggingOut] = useState(false);

  // Active playing course state (when video player is open in the main area)
  const [activeCourseSlug, setActiveCourseSlug] = useState<string | null>(
    initialCourseSlug || null,
  );
  const [activeLessonId, setActiveLessonId] = useState<string | null>(initialLessonId || null);
  const [activeLessonContent, setActiveLessonContent] = useState<PurchaseLessonContent | null>(
    null,
  );

  const handleOpenCourse = (slug: string, lessonId?: string | null) => {
    setActiveCourseSlug(slug);
    setActiveLessonId(lessonId || null);
    if (typeof window !== "undefined") {
      const url = lessonId
        ? `/dashboard?course=${encodeURIComponent(slug)}&lesson=${encodeURIComponent(lessonId)}`
        : `/dashboard?course=${encodeURIComponent(slug)}`;
      window.history.replaceState(null, "", url);
    }
  };

  const handleCloseCourse = () => {
    setActiveCourseSlug(null);
    setActiveLessonId(null);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/dashboard");
    }
  };

  const handleLessonChange = (lessonId: string) => {
    setActiveLessonId(lessonId);
    if (typeof window !== "undefined" && activeCourseSlug) {
      window.history.replaceState(
        null,
        "",
        `/dashboard?course=${encodeURIComponent(activeCourseSlug)}&lesson=${encodeURIComponent(lessonId)}`,
      );
    }
  };

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const r = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw new Error("Sign out failed. Please retry.");
      router.push("/login");
      router.refresh();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Sign out failed. Please retry.");
      setLoggingOut(false);
    }
  }

  // Enrolled courses list
  const enrolledCourses = useMemo(() => {
    return courses.length > 0 ? courses : allCourses.filter((c) => c.owned || c.accessExpiresAt);
  }, [courses, allCourses]);

  // Catalog for exploration (all courses)
  const catalogueList = useMemo(() => {
    return allCourses.length > 0 ? allCourses : enrolledCourses;
  }, [allCourses, enrolledCourses]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalEnrolled = enrolledCourses.length;
    let totalCompletedLessons = 0;
    let totalLessons = 0;
    let progressSum = 0;

    enrolledCourses.forEach((c) => {
      progressSum += c.progress;
      const allLessons = c.modules.flatMap((m) => m.lessons);
      totalLessons += allLessons.length;
      totalCompletedLessons += allLessons.filter((l) => l.completed).length;
    });

    const avgProgress = totalEnrolled > 0 ? Math.round(progressSum / totalEnrolled) : 0;
    const activeAccessCount = enrolledCourses.filter((c) => c.owned).length;

    return {
      totalEnrolled,
      avgProgress,
      totalCompletedLessons,
      totalLessons,
      activeAccessCount,
    };
  }, [enrolledCourses]);

  // Currently active or featured course to continue
  const featuredCourse = useMemo(() => {
    if (!enrolledCourses.length) return null;
    return enrolledCourses.find((c) => c.progress < 100) || enrolledCourses[0];
  }, [enrolledCourses]);

  const featuredNextLesson = useMemo(() => {
    if (!featuredCourse) return null;
    const lessons = featuredCourse.modules.flatMap((m) => m.lessons);
    return lessons.find((l) => !l.completed) || lessons[0];
  }, [featuredCourse]);

  // Filtered enrolled courses
  const filteredCourses = useMemo(() => {
    return enrolledCourses.filter((course) => {
      if (courseFilter === "in_progress") return course.progress > 0 && course.progress < 100;
      if (courseFilter === "completed") return course.progress === 100;
      return true;
    });
  }, [enrolledCourses, courseFilter]);

  // Filtered catalogue courses for explore tab
  const filteredExploreCourses = useMemo(() => {
    return catalogueList.filter((c) => {
      const matchQuery =
        !exploreQuery.trim() ||
        c.title.toLowerCase().includes(exploreQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(exploreQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(exploreQuery.toLowerCase());
      const matchLevel =
        exploreLevel === "all" || c.level.toLowerCase() === exploreLevel.toLowerCase();
      return matchQuery && matchLevel;
    });
  }, [catalogueList, exploreQuery, exploreLevel]);

  // Computed active course when user is watching a course in the main area
  const activeCourse = useMemo(() => {
    if (!activeCourseSlug) return null;
    return (
      courses.find((c) => c.slug === activeCourseSlug) ||
      allCourses.find((c) => c.slug === activeCourseSlug) ||
      null
    );
  }, [courses, allCourses, activeCourseSlug]);

  const activeLessonSummary = useMemo(() => {
    if (!activeCourse) return null;
    const lessons = activeCourse.modules.flatMap((m) => m.lessons);
    if (activeLessonId) {
      return lessons.find((l) => l.id === activeLessonId) || lessons[0];
    }
    return lessons.find((l) => !l.completed) || lessons[0];
  }, [activeCourse, activeLessonId]);

  const currentActiveLessonId = activeLessonSummary?.id;

  useEffect(() => {
    if (!currentActiveLessonId) {
      return;
    }
    let cancelled = false;
    fetch(`/api/purchase/lesson?id=${encodeURIComponent(currentActiveLessonId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.lesson) {
          setActiveLessonContent(data.lesson);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentActiveLessonId]);

  const activeLessonToPlay: PurchaseLessonContent | null = useMemo(() => {
    if (!activeLessonSummary) return null;
    if (activeLessonContent && activeLessonContent.id === activeLessonSummary.id) {
      return activeLessonContent;
    }
    return {
      id: activeLessonSummary.id,
      title: activeLessonSummary.title,
      duration: activeLessonSummary.duration,
      preview: activeLessonSummary.preview,
      completed: activeLessonSummary.completed,
      content:
        "In this lesson you'll learn what drives market movement, how market structure forms through highs and lows, and why understanding structure is essential for making better trading decisions.",
      videoUrl: "/sample-lesson.mp4",
      isDemo: true,
    };
  }, [activeLessonSummary, activeLessonContent]);

  return (
    <main id="main-content" className="admin-page student-dashboard-page">
      {/* =========================================================================
          LEFT SIDEBAR (Identical to Admin Workspace)
          ========================================================================= */}
      <aside className="admin-sidebar" aria-label="Student dashboard navigation">
        <Link href="/" className="admin-brand" aria-label="GlobalBulls storefront">
          <BullMark className="admin-brand-mark" />
          <span>
            Global<span>Bulls</span>
          </span>
        </Link>

        {/* Workspace pill */}
        <div className="admin-workspace-switcher" style={{ cursor: "default" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <GraduationCap size={18} color="var(--accent, #00df8f)" />
            <strong>Student workspace</strong>
          </span>
          <span className="student-role-pill">
            <i />
            Active
          </span>
        </div>

        {/* Navigation Group: STUDY */}
        <div className="admin-nav-group">
          <span className="admin-nav-label">Study</span>
          <button
            type="button"
            className={view === "courses" ? "is-active" : ""}
            onClick={() => {
              setView("courses");
              handleCloseCourse();
            }}
            aria-current={view === "courses" ? "page" : undefined}
          >
            <Books size={18} weight={view === "courses" ? "fill" : "regular"} />
            My courses ({enrolledCourses.length})
          </button>
        </div>

        {/* Navigation Group: DISCOVER */}
        <div className="admin-nav-group">
          <span className="admin-nav-label">Discover</span>
          <button
            type="button"
            className={view === "explore" ? "is-active" : ""}
            onClick={() => setView("explore")}
            aria-current={view === "explore" ? "page" : undefined}
          >
            <Compass size={18} weight={view === "explore" ? "fill" : "regular"} />
            Explore courses
          </button>
        </div>

        {/* Navigation Group: ACCOUNT */}
        <div className="admin-nav-group">
          <span className="admin-nav-label">Account</span>
          <button
            type="button"
            className={view === "billing" ? "is-active" : ""}
            onClick={() => setView("billing")}
            aria-current={view === "billing" ? "page" : undefined}
          >
            <Receipt size={18} weight={view === "billing" ? "fill" : "regular"} />
            Billing & receipts ({orders.length})
          </button>
          <button
            type="button"
            className={view === "account" ? "is-active" : ""}
            onClick={() => setView("account")}
            aria-current={view === "account" ? "page" : undefined}
          >
            <UserCircle size={18} weight={view === "account" ? "fill" : "regular"} />
            Profile & settings
          </button>
        </div>

        {/* Sidebar Bottom: Storefront & User Menu */}
        <div className="admin-sidebar-bottom">
          <Link href="/">
            <ArrowUUpLeft size={18} /> View storefront
          </Link>
          <button
            type="button"
            className="admin-user-menu"
            onClick={() => setView("account")}
            aria-label="Open profile settings"
          >
            <span className="admin-avatar">
              {(user.name || user.email).slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{user.name || "Student"}</strong>
              <small>{user.email}</small>
            </span>
            <CaretDown size={15} />
          </button>
          <button
            type="button"
            className="admin-signout"
            disabled={loggingOut}
            onClick={() => void logout()}
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* =========================================================================
          RIGHT CONTENT AREA
          ========================================================================= */}
      <div className="admin-content">
        {/* Top Header / Breadcrumb Bar */}
        <header className="student-top-bar">
          <div className="student-breadcrumb">
            <button
              type="button"
              className="student-breadcrumb-link"
              onClick={() => setView("courses")}
            >
              Student
            </button>
            <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>/</span>
            <span className="student-breadcrumb-current">
              {view === "courses" &&
                (activeCourse ? (
                  <>
                    <button
                      type="button"
                      className="student-breadcrumb-link"
                      onClick={handleCloseCourse}
                      style={{ display: "inline" }}
                    >
                      My courses
                    </button>
                    <span style={{ color: "rgba(255, 255, 255, 0.2)", margin: "0 8px" }}>/</span>
                    <span>{activeCourse.title}</span>
                  </>
                ) : (
                  "My courses"
                ))}
              {view === "explore" && "Explore courses"}
              {view === "billing" && "Billing & receipts"}
              {view === "account" && "Profile & settings"}
            </span>
          </div>

          <div className="student-top-actions">
            <ThemeToggle />
            <span className="student-role-pill">
              <i />
              Learner portal
            </span>
            {local && (
              <span
                style={{
                  fontSize: "11px",
                  color: "#f59e0b",
                  background: "rgba(245, 158, 11, 0.12)",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid rgba(245, 158, 11, 0.24)",
                }}
              >
                Local demo
              </span>
            )}
          </div>
        </header>

        {/* Inner Content Area */}
        <div className="student-main-content">
          {/* =====================================================================
              VIEW: MY COURSES (Combined Overview + Courses)
              ===================================================================== */}
          {view === "courses" &&
            (activeCourse && activeLessonToPlay ? (
              <div className="student-active-player-wrap">
                <PurchasePlayer
                  key={activeLessonToPlay.id}
                  course={activeCourse}
                  lesson={activeLessonToPlay}
                  user={user}
                  onBack={handleCloseCourse}
                  onLessonChange={handleLessonChange}
                />
              </div>
            ) : (
              <div>
              {/* Greeting Head */}
              <div className="student-greeting-head">
                <div>
                  <h1>My courses</h1>
                  <p>
                    Welcome back, {user.name.split(" ")[0]}. Track your progress, resume modules, and access your enrolled curriculum.
                  </p>
                </div>
                <div className="student-header-actions">
                  <button
                    type="button"
                    className="button button-primary button-sm"
                    onClick={() => setView("explore")}
                  >
                    <Compass size={16} />
                    <span>Explore catalogue</span>
                  </button>
                </div>
              </div>

              {/* 3 KPI Metrics */}
              <div className="student-metrics-grid">
                <div className="student-metric-card">
                  <div className="student-metric-card-top">
                    <span>Enrolled courses</span>
                    <div className="student-metric-icon">
                      <Books size={18} />
                    </div>
                  </div>
                  <strong>{stats.totalEnrolled}</strong>
                  <span className="student-metric-subtext">
                    {stats.activeAccessCount} active access
                  </span>
                </div>

                <div className="student-metric-card">
                  <div className="student-metric-card-top">
                    <span>Average progress</span>
                    <div className="student-metric-icon">
                      <CheckCircle size={18} />
                    </div>
                  </div>
                  <strong>{stats.avgProgress}%</strong>
                  <span className="student-metric-subtext">Overall completion rate</span>
                </div>

                <div className="student-metric-card">
                  <div className="student-metric-card-top">
                    <span>Active validity</span>
                    <div className="student-metric-icon">
                      <Clock size={18} />
                    </div>
                  </div>
                  <strong>{stats.activeAccessCount > 0 ? "Active" : "None"}</strong>
                  <span className="student-metric-subtext">Confirmed student access</span>
                </div>
              </div>

              {/* Featured "Continue Learning" Hero Card */}
              {featuredCourse && (
                <div className="student-hero-banner">
                  <div className="student-hero-content">
                    <span className="student-hero-tag">
                      <i />
                      In progress · Continue where you left off
                    </span>
                    <h2>{featuredCourse.title}</h2>
                    {featuredNextLesson && (
                      <div className="student-hero-lesson-label">
                        <PlayCircle size={16} color="var(--accent, #00df8f)" />
                        <span>Next up: {featuredNextLesson.title}</span>
                      </div>
                    )}
                    <div className="student-hero-progress-box">
                      <div className="student-hero-progress-info">
                        <span>Course progress</span>
                        <strong>{featuredCourse.progress}% completed</strong>
                      </div>
                      <div className="student-progress-bar">
                        <div
                          className="student-progress-fill"
                          style={{ width: `${featuredCourse.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="student-hero-actions">
                      {featuredCourse.owned ? (
                        <button
                          type="button"
                          className="button button-primary"
                          onClick={() => {
                            handleOpenCourse(featuredCourse.slug, featuredNextLesson?.id || null);
                          }}
                        >
                          <PlayCircle size={18} />
                          <span>
                            {featuredCourse.progress === 100
                              ? "Review course material"
                              : featuredCourse.progress > 0
                                ? "Resume lesson"
                                : "Start course"}
                          </span>
                        </button>
                      ) : (
                        <Link
                          className="button button-primary"
                          href={`/checkout/${featuredCourse.slug}`}
                        >
                          <PlayCircle size={18} />
                          <span>Renew course access</span>
                        </Link>
                      )}
                    </div>
                  </div>

                  <div
                    className="student-hero-thumb-side"
                    style={{ cursor: featuredCourse.owned ? "pointer" : "default" }}
                    onClick={() => {
                      if (featuredCourse.owned) {
                        handleOpenCourse(featuredCourse.slug, featuredNextLesson?.id || null);
                      }
                    }}
                  >
                    {featuredCourse.thumbnail ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={featuredCourse.thumbnail} alt={featuredCourse.title} />
                    ) : (
                      <CourseArtwork
                        kind={
                          featuredCourse.slug.includes("price")
                            ? "structure"
                            : featuredCourse.slug.includes("risk")
                              ? "risk"
                              : "foundations"
                        }
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Enrolled Courses Section with Sub-filters */}
              <div className="student-section-block">
                <div className="student-section-title-row">
                  <h3>All enrolled courses</h3>
                  <span>{enrolledCourses.length} total enrolled</span>
                </div>

                {/* Sub-filter pills */}
                <div className="student-filter-pills">
                  <button
                    type="button"
                    className={`student-pill-btn ${courseFilter === "all" ? "is-active" : ""}`}
                    onClick={() => setCourseFilter("all")}
                  >
                    All courses ({enrolledCourses.length})
                  </button>
                  <button
                    type="button"
                    className={`student-pill-btn ${
                      courseFilter === "in_progress" ? "is-active" : ""
                    }`}
                    onClick={() => setCourseFilter("in_progress")}
                  >
                    In progress ({enrolledCourses.filter((c) => c.progress > 0 && c.progress < 100).length})
                  </button>
                  <button
                    type="button"
                    className={`student-pill-btn ${courseFilter === "completed" ? "is-active" : ""}`}
                    onClick={() => setCourseFilter("completed")}
                  >
                    Completed ({enrolledCourses.filter((c) => c.progress === 100).length})
                  </button>
                </div>

                {filteredCourses.length ? (
                  <div className="student-course-grid">
                    {filteredCourses.map((course) => {
                      const allLessons = course.modules.flatMap((m) => m.lessons);
                      const completedLessons = allLessons.filter((l) => l.completed).length;
                      const next = allLessons.find((l) => !l.completed) || allLessons[0];
                      const isExpired = !course.owned;

                      return (
                        <article className="student-course-card" key={course.id}>
                          <div
                            className="student-course-card-thumb"
                            style={{ cursor: isExpired ? "default" : "pointer" }}
                            onClick={() => {
                              if (!isExpired) {
                                handleOpenCourse(course.slug, next?.id || null);
                              }
                            }}
                          >
                            {course.thumbnail ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={course.thumbnail} alt={course.title} />
                            ) : (
                              <CourseArtwork
                                kind={
                                  course.slug.includes("price")
                                    ? "structure"
                                    : course.slug.includes("risk")
                                      ? "risk"
                                      : "foundations"
                                }
                              />
                            )}
                            <span
                              className={`student-course-status-badge ${
                                isExpired ? "status-expired" : "status-active"
                              }`}
                            >
                              {isExpired ? "Access expired" : "Active access"}
                            </span>
                          </div>

                          <div className="student-course-card-body">
                            <h4
                              style={{ cursor: isExpired ? "default" : "pointer" }}
                              onClick={() => {
                                if (!isExpired) {
                                handleOpenCourse(course.slug, next?.id || null);
                              }
                            }}
                          >
                              {course.title}
                            </h4>
                            <div className="student-course-meta-row">
                              <span>
                                <Clock size={14} />
                                {course.accessExpiresAt
                                  ? accessExpiryLabel(course.accessExpiresAt)
                                  : "Unlimited"}
                              </span>
                              <span>·</span>
                              <span>{completedLessons} / {allLessons.length} lessons</span>
                            </div>

                            <div className="student-course-progress-wrap">
                              <div className="student-course-progress-label">
                                <span>Overall completion</span>
                                <strong>{course.progress}%</strong>
                              </div>
                              <div className="student-progress-bar">
                                <div
                                  className="student-progress-fill"
                                  style={{ width: `${course.progress}%` }}
                                />
                              </div>
                            </div>

                            <div className="student-course-card-footer">
                              {isExpired ? (
                                <Link
                                  className="button button-primary button-sm"
                                  style={{ width: "100%", justifyContent: "center" }}
                                  href={`/checkout/${course.slug}`}
                                >
                                  Renew course access
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  className="button button-primary button-sm"
                                  style={{ width: "100%", justifyContent: "center" }}
                                  onClick={() => {
                                    handleOpenCourse(course.slug, next?.id || null);
                                  }}
                                >
                                  <PlayCircle size={15} />
                                  <span>
                                    {course.progress === 100
                                      ? "Review course"
                                      : course.progress > 0
                                        ? "Continue learning"
                                        : "Start course"}
                                  </span>
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
                    <h3>No courses matching this filter</h3>
                    <p>You can change the tab filter or browse all courses in the platform catalogue.</p>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setCourseFilter("all")}
                    >
                      Show all enrolled courses
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* =====================================================================
              VIEW: EXPLORE COURSES
              ===================================================================== */}
          {view === "explore" && (
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
                    placeholder="Search courses by topic, title or keywords…"
                  />
                </div>
                <select
                  value={exploreLevel}
                  onChange={(e) => setExploreLevel(e.target.value)}
                >
                  <option value="all">All levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              {/* Courses Catalogue Grid */}
              {filteredExploreCourses.length ? (
                <div className="student-course-grid">
                  {filteredExploreCourses.map((c) => {
                    const isOwned = c.owned;
                    const priceInRupees = Math.round(c.price / 100);

                    return (
                      <article className="student-explore-card" key={c.id}>
                        <div className="student-explore-card-thumb">
                          {c.thumbnail ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={c.thumbnail} alt={c.title} />
                          ) : (
                            <CourseArtwork
                              kind={
                                c.slug.includes("price")
                                  ? "structure"
                                  : c.slug.includes("risk")
                                    ? "risk"
                                    : "foundations"
                              }
                            />
                          )}
                          <span className="student-explore-price-tag">
                            ₹{priceInRupees.toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div className="student-explore-card-body">
                          <span className="student-explore-level-badge">{c.level}</span>
                          <h4>{c.title}</h4>
                          <p>{c.description}</p>

                          <ul className="student-explore-features">
                            <li>
                              <Check size={14} color="var(--accent, #00df8f)" />
                              <span>{c.accessPeriod} {c.accessUnit} full access</span>
                            </li>
                            <li>
                              <Check size={14} color="var(--accent, #00df8f)" />
                              <span>
                                {c.modules.flatMap((m) => m.lessons).length} detailed lessons
                              </span>
                            </li>
                            <li>
                              <Check size={14} color="var(--accent, #00df8f)" />
                              <span>Hindi audio instruction & notes</span>
                            </li>
                          </ul>

                          <div className="student-explore-card-footer">
                            {isOwned ? (
                              <button
                                type="button"
                                className="button button-secondary"
                                style={{ width: "100%", justifyContent: "center" }}
                                onClick={() => {
                                  setView("courses");
                                  const firstLesson =
                                    c.modules.flatMap((m) => m.lessons).find((l) => !l.completed) ||
                                    c.modules[0]?.lessons[0];
                                  handleOpenCourse(c.slug, firstLesson?.id || null);
                                }}
                              >
                                <CheckCircle size={16} color="var(--accent, #00df8f)" />
                                <span>Enrolled · Open course</span>
                              </button>
                            ) : (
                              <Link
                                className="button button-primary"
                                style={{ width: "100%", justifyContent: "center" }}
                                href={`/courses/${c.slug}`}
                              >
                                <span>View course & enroll</span>
                                <ArrowRight size={16} />
                              </Link>
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
          )}

          {/* =====================================================================
              VIEW: BILLING & RECEIPTS
              ===================================================================== */}
          {view === "billing" && (
            <div>
              <div className="student-greeting-head">
                <div>
                  <h1>Billing & receipts</h1>
                  <p>Order history, GST payment receipts, and enrollment invoices.</p>
                </div>
              </div>

              {orders.length ? (
                <div className="student-orders-card">
                  <table className="student-orders-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Course</th>
                        <th>Date (IST)</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => {
                        const formattedDate = new Date(order.createdAt).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Kolkata",
                          },
                        );

                        return (
                          <tr key={order.id}>
                            <td>
                              <span style={{ fontFamily: "var(--mono)", fontSize: "12px", color: "var(--muted)" }}>
                                {order.id.slice(0, 8)}…
                              </span>
                            </td>
                            <td>
                              <strong>{order.courseTitle}</strong>
                            </td>
                            <td>
                              <span style={{ color: "var(--muted)" }}>{formattedDate}</span>
                            </td>
                            <td>
                              <strong>
                                ₹{(order.amount / 100).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </strong>
                            </td>
                            <td>
                              <span className={`student-order-status-badge ${order.status}`}>
                                {order.status}
                              </span>
                            </td>
                            <td>
                              {["paid", "refunded"].includes(order.status) ? (
                                <Link
                                  href={`/dashboard/orders/${order.id}/receipt`}
                                  className="button button-secondary button-sm"
                                  style={{ padding: "4px 10px", fontSize: "12px" }}
                                >
                                  View receipt
                                </Link>
                              ) : (
                                <Link
                                  href={`/checkout/${order.slug || order.courseId}`}
                                  className="button button-primary button-sm"
                                  style={{ padding: "4px 10px", fontSize: "12px" }}
                                >
                                  Retry checkout
                                </Link>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="student-empty-state">
                  <h3>No purchase history found</h3>
                  <p>When you purchase a course, your tax receipt and order invoice will appear here.</p>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setView("explore")}
                  >
                    Browse courses
                  </button>
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              VIEW: PROFILE & SETTINGS
              ===================================================================== */}
          {view === "account" && (
            <div>
              <div className="student-greeting-head">
                <div>
                  <h1>Profile & settings</h1>
                  <p>Manage your student credentials, security sessions, and account details.</p>
                </div>
              </div>

              <div className="student-profile-grid">
                <div className="student-profile-card">
                  <div className="student-profile-avatar-big">
                    {(user.name || user.email).slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: "18px" }}>{user.name}</h3>
                    <span className="student-role-pill">
                      <i />
                      Verified student
                    </span>
                  </div>

                  <div className="student-info-row">
                    <span className="student-info-label">Email address</span>
                    <span className="student-info-val">{user.email}</span>
                  </div>

                  <div className="student-info-row">
                    <span className="student-info-label">Account type</span>
                    <span className="student-info-val">Learner portal</span>
                  </div>

                  <div className="student-info-row">
                    <span className="student-info-label">User ID</span>
                    <span
                      className="student-info-val"
                      style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)" }}
                    >
                      {user.id}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="button button-danger button-sm"
                    disabled={loggingOut}
                    onClick={() => void logout()}
                    style={{ marginTop: "12px" }}
                  >
                    {loggingOut ? "Signing out…" : "Sign out from this device"}
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div className="student-profile-card">
                    <h3 style={{ margin: "0 0 8px", fontSize: "16px" }}>
                      Security & Single Session
                    </h3>
                    <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
                      To protect course materials and comply with our terms, your account is tied
                      to verified single-device playback. If you switch devices, your previous
                      session is cleanly released.
                    </p>
                    <Link href="/account" className="button button-secondary button-sm" style={{ alignSelf: "flex-start" }}>
                      <ShieldCheck size={16} />
                      <span>Manage registered devices</span>
                    </Link>
                  </div>

                  <div className="student-profile-card">
                    <h3 style={{ margin: "0 0 8px", fontSize: "16px" }}>
                      Refund Support & Assistance
                    </h3>
                    <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
                      Need help with an order, or have questions about course access? Our support team
                      is available to assist you.
                    </p>
                    <Link
                      href="/contact?topic=refund"
                      className="button button-secondary button-sm"
                      style={{ alignSelf: "flex-start" }}
                    >
                      <Question size={16} />
                      <span>Contact support desk</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
