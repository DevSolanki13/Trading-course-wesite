"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Books,
  Compass,
  Receipt,
  UserCircle,
  CaretDown,
  PlayCircle,
  CheckCircle,
  Clock,
  GraduationCap,
} from "@phosphor-icons/react";
import { BullMark } from "./bull-mark";
import { CourseArtwork } from "./course-artwork";
import { CourseThumbnail } from "./course-thumbnail";
const PurchasePlayer = dynamic(() =>
  import("./purchase-player").then((module) => module.PurchasePlayer),
);
import { ThemeToggle } from "./theme-toggle";
import { StudentExplorePanel } from "./student/student-explore-panel";
import { StudentBillingPanel } from "./student/student-billing-panel";
import { StudentProfilePanel } from "./student/student-profile-panel";
import { StudentAnnouncementTicker } from "./student/student-announcement-ticker";
import type {
  PurchaseUser,
  PurchaseCourse,
  PurchaseOrder,
  PurchaseOrdersPage,
  PurchaseLessonContent,
} from "../../shared/purchase";
import type { Announcement } from "../../shared/announcements";
import { accessExpiryLabel } from "../../shared/course-access";
import { useBillingOrders } from "../lib/use-billing-orders";
import { useAnnouncements } from "../lib/use-announcements";
import { useAuth } from "./auth-provider";

interface StudentDashboardProps {
  user: PurchaseUser;
  courses: PurchaseCourse[];
  allCourses?: PurchaseCourse[];
  orders: PurchaseOrder[];
  orderCount?: number;
  ordersFresh?: boolean;
  ordersPage?: PurchaseOrdersPage;
  announcements?: Announcement[];
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
  orders: initialOrders,
  orderCount,
  ordersFresh = false,
  ordersPage,
  announcements,
  initialView = "courses",
  ordersOnly = false,
  local = false,
  initialCourseSlug,
  initialLessonId,
}: StudentDashboardProps) {
  const router = useRouter();
  const auth = useAuth();
  const sessionMismatch = auth.invalidated || (auth.ready && auth.user?.id !== user.id);
  const [view, setView] = useState<"courses" | "explore" | "billing" | "account">(
    ordersOnly ? "billing" : initialView,
  );
  const [courseFilter, setCourseFilter] = useState<"all" | "in_progress" | "completed">("all");
  const {
    orders,
    syncing: billingSyncing,
    error: billingError,
    refresh: refreshBilling,
    loaded: billingLoaded,
    page: billingPage,
    pageNumber,
    nextPage,
    previousPage,
    status: billingStatus,
    provider: billingProvider,
    setStatus: setBillingStatus,
    setProvider: setBillingProvider,
  } = useBillingOrders(
    initialOrders,
    view === "billing" && !sessionMismatch,
    ordersFresh,
    ordersPage,
  );
  const [exploreQuery, setExploreQuery] = useState("");
  const [exploreLevel, setExploreLevel] = useState("all");
  const [loggingOut, setLoggingOut] = useState(false);

  const announcementsList = useAnnouncements(announcements, user.id);

  useEffect(() => {
    if (!auth.ready) return;
    if (auth.error?.code === "DEVICE_LIMIT") router.replace("/auth/devices?next=%2Fdashboard");
    else if (!auth.user && (!auth.error || auth.error.status === 401))
      router.replace("/login?redirect=%2Fdashboard");
    else if (auth.user && auth.user.id !== user.id) router.refresh();
  }, [auth.ready, auth.user, auth.error, user.id, router]);

  // Active playing course state (when video player is open in the main area)
  const [activeCourseSlug, setActiveCourseSlug] = useState<string | null>(
    initialCourseSlug || null,
  );
  const [activeLessonId, setActiveLessonId] = useState<string | null>(initialLessonId || null);
  const [activeLessonContent, setActiveLessonContent] = useState<PurchaseLessonContent | null>(
    null,
  );
  const [lessonState, setLessonState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [lessonErrorMessage, setLessonErrorMessage] = useState<string | null>(null);
  const [lessonFetchTrigger, setLessonFetchTrigger] = useState(0);

  const handleSelectView = (
    targetView: "courses" | "explore" | "billing" | "account",
    event?: React.MouseEvent<HTMLButtonElement>,
  ) => {
    setView(targetView);
    if (targetView === "courses") {
      handleCloseCourse();
    } else {
      setActiveCourseSlug(null);
      setActiveLessonId(null);
    }
    if (typeof window !== "undefined") {
      const url = targetView === "courses" ? "/dashboard" : `/dashboard?view=${targetView}`;
      window.history.pushState(null, "", url);
    }
    event?.currentTarget.focus();
  };

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("view") || params.get("tab");
      const urlView =
        requested === "orders"
          ? "billing"
          : requested === "profile" || requested === "devices"
            ? "account"
            : requested === "study"
              ? "courses"
              : requested;
      const urlCourse = params.get("course");
      const urlLesson = params.get("lesson");
      if (
        urlView === "explore" ||
        urlView === "billing" ||
        urlView === "account" ||
        urlView === "courses"
      ) {
        setView(urlView);
      } else if (!urlCourse) {
        setView("courses");
      }
      if (urlCourse) {
        setActiveCourseSlug(urlCourse);
        setActiveLessonId(urlLesson || null);
      } else {
        setActiveCourseSlug(null);
        setActiveLessonId(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const [activeCourseOrigin, setActiveCourseOrigin] = useState<"courses" | "explore">("courses");
  const [lastExploreSlug, setLastExploreSlug] = useState<string | null>(initialCourseSlug || null);

  const handleOpenCourse = (slug: string, lessonId?: string | null) => {
    if (
      slug === activeCourseSlug &&
      activeLessonContent &&
      (!lessonId || lessonId === activeLessonContent.id)
    ) {
      setView("courses");
      return;
    }
    if (slug === activeCourseSlug) setLessonFetchTrigger((value) => value + 1);
    setActiveCourseOrigin(view === "explore" ? "explore" : "courses");
    if (view === "explore") {
      setLastExploreSlug(slug);
    }
    setView("courses");
    setActiveCourseSlug(slug);
    setActiveLessonId(lessonId || null);
    setActiveLessonContent(null);
    setLessonState("loading");
    setLessonErrorMessage(null);
    if (typeof window !== "undefined") {
      const url = lessonId
        ? `/dashboard?course=${encodeURIComponent(slug)}&lesson=${encodeURIComponent(lessonId)}`
        : `/dashboard?course=${encodeURIComponent(slug)}`;
      window.history.pushState(null, "", url);
    }
  };

  const handleCloseCourse = () => {
    const origin = activeCourseOrigin;
    setActiveCourseSlug(null);
    setActiveLessonId(null);
    setActiveLessonContent(null);
    setLessonState("idle");
    setLessonErrorMessage(null);
    if (origin === "explore") {
      setView("explore");
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", "/dashboard?view=explore");
      }
    } else {
      setView("courses");
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", "/dashboard");
      }
    }
  };

  const handleLessonChange = (lessonId: string) => {
    if (lessonId === currentActiveLessonId) {
      if (activeLessonContent || lessonState === "loading") return;
      setLessonFetchTrigger((value) => value + 1);
    }
    setActiveLessonId(lessonId);
    setActiveLessonContent(null);
    setLessonState("loading");
    setLessonErrorMessage(null);
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
      auth.clear();
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

  // Available levels derived dynamically from published courses
  const availableLevels = useMemo(() => {
    const set = new Set<string>();
    for (const c of catalogueList) {
      if (c.level) set.add(c.level.trim());
    }
    return Array.from(set);
  }, [catalogueList]);

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
    if (!currentActiveLessonId || sessionMismatch) {
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    fetch(`/api/purchase/lesson?id=${encodeURIComponent(currentActiveLessonId)}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData?.error || `Unable to load lesson (HTTP ${r.status})`);
        }
        return r.json();
      })
      .then((data) => {
        if (!cancelled) {
          if (data.lesson) {
            setActiveLessonContent(data.lesson);
            setLessonState("ready");
          } else {
            setLessonState("error");
            setLessonErrorMessage("Lesson content could not be found.");
          }
        }
      })
      .catch((err) => {
        if (!cancelled && err.name !== "AbortError") {
          setLessonState("error");
          setLessonErrorMessage(
            err instanceof Error ? err.message : "Failed to load lesson content.",
          );
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentActiveLessonId, lessonFetchTrigger, sessionMismatch]);

  // A fresh identity mismatch must not leave the previous account's data visible.
  if (sessionMismatch)
    return (
      <main id="main-content" aria-busy="true">
        <p role={auth.error ? "alert" : "status"}>
          {auth.error?.message ?? "Checking your session…"}
        </p>
        {auth.error && (
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void auth.refresh()}
          >
            Retry session check
          </button>
        )}
      </main>
    );

  return (
    <main id="main-content" className="admin-page student-dashboard-page">
      {/* =========================================================================
          LEFT SIDEBAR (Identical to Admin Workspace)
          ========================================================================= */}
      <aside className="admin-sidebar" aria-label="Student dashboard navigation">
        <Link href="/" className="admin-brand" aria-label="indianXtrade storefront">
          <BullMark className="admin-brand-mark" height={54} />
        </Link>

        {/* Workspace pill */}
        <div
          className="student-workspace-switcher"
          role="status"
          aria-label="Current workspace: Student"
        >
          <div className="student-workspace-info">
            <GraduationCap size={17} weight="duotone" color="var(--accent, #00df8f)" />
            <span>Student workspace</span>
          </div>
          <span className="student-workspace-status">
            <i />
            Active
          </span>
        </div>

        {/* Navigation Group: STUDY */}
        <div className="admin-nav-group" role="tablist" aria-label="Study navigation">
          <span className="admin-nav-label">Study</span>
          <button
            type="button"
            role="tab"
            aria-selected={view === "courses"}
            className={view === "courses" ? "is-active" : ""}
            onClick={(e) => handleSelectView("courses", e)}
            aria-current={view === "courses" ? "page" : undefined}
          >
            <Books size={18} weight={view === "courses" ? "fill" : "regular"} />
            <span>My courses</span>
            <span className="student-nav-badge">({enrolledCourses.length})</span>
          </button>
        </div>

        {/* Navigation Group: DISCOVER */}
        <div className="admin-nav-group" role="tablist" aria-label="Discover navigation">
          <span className="admin-nav-label">Discover</span>
          <button
            type="button"
            role="tab"
            aria-selected={view === "explore"}
            className={view === "explore" ? "is-active" : ""}
            onClick={(e) => handleSelectView("explore", e)}
            aria-current={view === "explore" ? "page" : undefined}
          >
            <Compass size={18} weight={view === "explore" ? "fill" : "regular"} />
            <span>Explore courses</span>
          </button>
        </div>

        {/* Navigation Group: ACCOUNT */}
        <div className="admin-nav-group" role="tablist" aria-label="Account navigation">
          <span className="admin-nav-label">Account</span>
          <button
            type="button"
            role="tab"
            aria-selected={view === "billing"}
            className={view === "billing" ? "is-active" : ""}
            onClick={(e) => handleSelectView("billing", e)}
            aria-current={view === "billing" ? "page" : undefined}
          >
            <Receipt size={18} weight={view === "billing" ? "fill" : "regular"} />
            <span>Billing & receipts</span>
            <span className="student-nav-badge">
              ({billingPage?.totalCount ?? orderCount ?? orders.length})
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "account"}
            className={view === "account" ? "is-active" : ""}
            onClick={(e) => handleSelectView("account", e)}
            aria-current={view === "account" ? "page" : undefined}
          >
            <UserCircle size={18} weight={view === "account" ? "fill" : "regular"} />
            <span>Profile & settings</span>
          </button>
        </div>

        {/* Sidebar Bottom: User Menu */}
        <div className="admin-sidebar-bottom">
          <button
            type="button"
            className="admin-user-menu"
            onClick={(e) => handleSelectView("account", e)}
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
              onClick={() => handleSelectView("courses")}
            >
              Student
            </button>
            <span style={{ color: "var(--border, rgba(255, 255, 255, 0.2))" }}>/</span>
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
                    <span
                      style={{ color: "var(--border, rgba(255, 255, 255, 0.2))", margin: "0 8px" }}
                    >
                      /
                    </span>
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
            {local && <span className="student-demo-badge">Local demo</span>}
          </div>
        </header>

        <StudentAnnouncementTicker announcements={announcementsList} />

        {/* Inner Content Area */}
        <div className="student-main-content">
          {/* =====================================================================
              VIEW: MY COURSES (Combined Overview + Courses)
              ===================================================================== */}
          {view === "courses" &&
            (activeCourse ? (
              activeLessonContent ? (
                <div className="student-active-player-wrap">
                  <PurchasePlayer
                    key={activeLessonContent.id}
                    course={activeCourse}
                    lesson={activeLessonContent}
                    user={user}
                    onBack={handleCloseCourse}
                    onLessonChange={handleLessonChange}
                  />
                </div>
              ) : lessonState === "error" ? (
                <div className="student-active-player-wrap" style={{ padding: "40px 24px" }}>
                  <div
                    style={{
                      maxWidth: "520px",
                      margin: "60px auto",
                      textAlign: "center",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      padding: "32px 24px",
                    }}
                    role="alert"
                  >
                    <h3
                      style={{
                        fontSize: "18px",
                        color: "var(--danger, #ff4d4f)",
                        margin: "0 0 8px",
                      }}
                    >
                      We couldn&apos;t load this lesson
                    </h3>
                    <p style={{ color: "var(--muted)", fontSize: "14px", margin: "0 0 20px" }}>
                      {lessonErrorMessage ||
                        "An unexpected error occurred while loading this lesson. Please check your connection or retry."}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        justifyContent: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        className="button button-primary button-sm"
                        onClick={() => {
                          setLessonState("loading");
                          setLessonErrorMessage(null);
                          setLessonFetchTrigger((v) => v + 1);
                        }}
                      >
                        Retry loading
                      </button>
                      <button
                        type="button"
                        className="button button-secondary button-sm"
                        onClick={handleCloseCourse}
                      >
                        Back to courses
                      </button>
                      <Link
                        href="/contact?topic=learning"
                        className="button button-secondary button-sm"
                      >
                        Contact support
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="student-active-player-wrap"
                  style={{ padding: "40px 24px", textAlign: "center" }}
                >
                  <div style={{ maxWidth: "480px", margin: "60px auto" }}>
                    <div className="admin-loading-spinner" style={{ margin: "0 auto 16px" }} />
                    <h3 style={{ fontSize: "18px", margin: "0 0 8px" }}>Loading classroom...</h3>
                    <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0 }}>
                      Preparing lesson materials and authorized stream.
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="student-dashboard-layout">
                {/* PRIMARY STAGE: Greeting, Continue Learning, All Courses */}
                <div className="student-main-stage">
                  {/* Greeting Head */}
                  <div className="student-greeting-head">
                    <div>
                      <h1>My courses</h1>
                      <p>
                        Welcome back, {user.name.split(" ")[0]}. Track your progress, resume
                        modules, and access your enrolled curriculum.
                      </p>
                    </div>
                    <div className="student-header-actions">
                      <button
                        type="button"
                        className="button button-primary button-sm"
                        onClick={() => handleSelectView("explore")}
                      >
                        <Compass size={16} />
                        <span>Explore catalogue</span>
                      </button>
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
                                handleOpenCourse(
                                  featuredCourse.slug,
                                  featuredNextLesson?.id || null,
                                );
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
                          <CourseThumbnail
                            src={featuredCourse.thumbnail}
                            alt={featuredCourse.title}
                          />
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
                        In progress (
                        {enrolledCourses.filter((c) => c.progress > 0 && c.progress < 100).length})
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
                                  <CourseThumbnail src={course.thumbnail} alt={course.title} />
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
                                  <span>
                                    {completedLessons} / {allLessons.length} lessons
                                  </span>
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
                        <p>
                          You can change the tab filter or browse all courses in the platform
                          catalogue.
                        </p>
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

                {/* COMPANION RAIL: Fills the empty widescreen space */}
                <aside className="student-companion-rail">
                  {/* Learning Vitals / Metrics Tile Card */}
                  <div className="student-rail-metrics-card">
                    <div className="student-rail-card-head">
                      <h4>Learning Vitals</h4>
                      <span>Overview</span>
                    </div>

                    <div className="student-rail-metrics-grid">
                      <div className="student-rail-metric-tile">
                        <div className="student-metric-icon">
                          <Books size={16} />
                        </div>
                        <div>
                          <strong>{stats.totalEnrolled}</strong>
                          <small>Enrolled courses</small>
                        </div>
                      </div>

                      <div className="student-rail-metric-tile">
                        <div className="student-metric-icon">
                          <CheckCircle size={16} />
                        </div>
                        <div>
                          <strong>{stats.avgProgress}%</strong>
                          <small>Avg. completion</small>
                        </div>
                      </div>

                      <div className="student-rail-metric-tile full-width">
                        <div className="student-metric-icon">
                          <Clock size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <strong>
                              {stats.activeAccessCount > 0 ? "Active Access" : "Expired"}
                            </strong>
                            <span
                              className="student-role-pill"
                              style={{ padding: "2px 8px", fontSize: "10px" }}
                            >
                              <i /> Confirmed
                            </span>
                          </div>
                          <small>{stats.activeAccessCount} course license(s) active</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            ))}

          {/* =====================================================================
              VIEW: EXPLORE COURSES
              ===================================================================== */}
          {view === "explore" && (
            <StudentExplorePanel
              exploreQuery={exploreQuery}
              setExploreQuery={setExploreQuery}
              exploreLevel={exploreLevel}
              setExploreLevel={setExploreLevel}
              availableLevels={availableLevels}
              filteredExploreCourses={filteredExploreCourses}
              onSelectCoursesView={() => handleSelectView("courses")}
              onOpenCourse={handleOpenCourse}
              initialSelectedCourseSlug={lastExploreSlug || initialCourseSlug}
            />
          )}

          {/* =====================================================================
              VIEW: BILLING & RECEIPTS
              ===================================================================== */}
          {view === "billing" && (
            <StudentBillingPanel
              orders={orders}
              page={billingPage}
              pageNumber={pageNumber}
              onNextPage={nextPage}
              onPreviousPage={previousPage}
              status={billingStatus}
              provider={billingProvider}
              onStatusChange={setBillingStatus}
              onProviderChange={setBillingProvider}
              syncing={billingSyncing || (!billingLoaded && !billingError)}
              error={billingError}
              onRefresh={refreshBilling}
              onBrowseCourses={() => handleSelectView("explore")}
            />
          )}

          {/* =====================================================================
              VIEW: PROFILE & SETTINGS
              ===================================================================== */}
          {view === "account" && (
            <StudentProfilePanel
              user={user}
              local={local}
              loggingOut={loggingOut}
              onLogout={() => void logout()}
              onSelectCoursesView={() => handleSelectView("courses")}
            />
          )}
        </div>
      </div>

      {/* Mobile navigation bar — visible on screens <= 900px */}
      <nav className="workspace-mobile-nav" aria-label="Student workspace navigation">
        <button
          type="button"
          className={view === "courses" ? "is-active" : ""}
          aria-current={view === "courses" ? "page" : undefined}
          onClick={(e) => handleSelectView("courses", e)}
        >
          <Books size={20} weight={view === "courses" ? "fill" : "regular"} />
          <span>My courses</span>
        </button>
        <button
          type="button"
          className={view === "explore" ? "is-active" : ""}
          aria-current={view === "explore" ? "page" : undefined}
          onClick={(e) => handleSelectView("explore", e)}
        >
          <Compass size={20} weight={view === "explore" ? "fill" : "regular"} />
          <span>Explore</span>
        </button>
        <button
          type="button"
          className={view === "billing" ? "is-active" : ""}
          aria-current={view === "billing" ? "page" : undefined}
          onClick={(e) => handleSelectView("billing", e)}
        >
          <Receipt size={20} weight={view === "billing" ? "fill" : "regular"} />
          <span>Billing</span>
        </button>
        <button
          type="button"
          className={view === "account" ? "is-active" : ""}
          aria-current={view === "account" ? "page" : undefined}
          onClick={(e) => handleSelectView("account", e)}
        >
          <UserCircle size={20} weight={view === "account" ? "fill" : "regular"} />
          <span>Profile</span>
        </button>
      </nav>
    </main>
  );
}
