"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CaretDown,
  Check,
  CheckCircle,
  ClosedCaptioning,
  CornersIn,
  CornersOut,
  DownloadSimple,
  FilePdf,
  LockSimple,
  NotePencil,
  Pause,
  PictureInPicture,
  Play,
  PlayCircle,
  ShieldCheck,
  SpeakerHigh,
  SpeakerSimpleSlash,
  CalendarBlank,
} from "@phosphor-icons/react";
import type { PurchaseCourse, PurchaseLessonContent, PurchaseUser } from "../../shared/purchase";
import { accessExpiryLabel } from "../../shared/course-access";
import { BullMark } from "./bull-mark";
import { CourseArtwork } from "./course-artwork";

export function PurchasePlayer({
  course,
  lesson,
  user,
  onBack,
  onLessonChange,
}: {
  course: PurchaseCourse;
  lesson: PurchaseLessonContent;
  user?: PurchaseUser | null;
  onBack?: () => void;
  onLessonChange?: (lessonId: string) => void;
}) {
  const router = useRouter();

  // State management
  const [pending, setPending] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "notes" | "resources">("overview");

  // Video playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);

  // Student notes state with localStorage persistence
  const [notes, setNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  // User-scoped storage key prevents note leaks between different accounts on shared devices
  const userScopedKey = user?.id
    ? `indianxtrade_notes_${user.id}_${lesson.id}`
    : `indianxtrade_notes_guest_${lesson.id}`;

  // Collapsed modules state (record of module id -> boolean)
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const vdoIframeRef = useRef<HTMLIFrameElement>(null);

  // Flattened lessons list & indices
  const allLessons = useMemo(() => {
    return course.modules.flatMap((m) => m.lessons);
  }, [course.modules]);

  const currentIndex = useMemo(() => {
    return allLessons.findIndex((l) => l.id === lesson.id);
  }, [allLessons, lesson.id]);

  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const totalLessons = allLessons.length;
  const completedLessonsCount = allLessons.filter((l) => l.completed).length;

  // Load notes from localStorage for this lesson (scoped to current account)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem(userScopedKey);
        setNotes(saved ?? "");
        setSaveStatus("saved");
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [userScopedKey]);

  // Debounced auto-save notes to preserve changes without requiring manual button clicks
  useEffect(() => {
    if (!notes) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(userScopedKey, notes);
        setSaveStatus("saved");
      } catch {
        // ignore
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [notes, userScopedKey]);

  // Handle access expiry timer
  useEffect(() => {
    if (lesson.preview || !course.accessExpiresAt) return;
    let timer: ReturnType<typeof setTimeout>;
    function checkExpiry() {
      const remaining = Date.parse(course.accessExpiresAt!) - Date.now();
      if (remaining > 0) {
        timer = setTimeout(checkExpiry, Math.min(remaining, 2147483647));
        return;
      }
      videoRef.current?.pause();
      videoRef.current?.removeAttribute("src");
      videoRef.current?.load();
      router.replace(`/courses/${course.slug}?message=access-expired`);
      router.refresh();
    }
    checkExpiry();
    return () => clearTimeout(timer);
  }, [course.accessExpiresAt, course.slug, lesson.preview, router]);

  // Mark lesson complete callback
  const complete = useCallback(
    async (explicitValue?: boolean, autoAdvance = false) => {
      const nextCompleted = explicitValue !== undefined ? explicitValue : !lesson.completed;
      if (explicitValue !== undefined && lesson.completed === explicitValue) {
        if (autoAdvance && nextLesson) {
          if (onLessonChange) {
            onLessonChange(nextLesson.id);
          } else {
            router.push(`/learn/${course.slug}/${nextLesson.id}`);
          }
        }
        return;
      }

      setPending(true);
      try {
        const r = await fetch("/api/purchase/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId: lesson.id, completed: nextCompleted }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Progress could not be saved.");

        toast.success(
          nextCompleted
            ? "Lesson completed! Course progress updated."
            : "Lesson marked incomplete.",
        );

        router.refresh();

        if (autoAdvance && nextCompleted && nextLesson) {
          if (onLessonChange) {
            onLessonChange(nextLesson.id);
          } else {
            router.push(`/learn/${course.slug}/${nextLesson.id}`);
          }
        }
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : "Progress could not be saved.";
        toast.error(message);
      } finally {
        setPending(false);
      }
    },
    [lesson.id, lesson.completed, nextLesson, course.slug, router, onLessonChange],
  );

  // VdoCipher DRM Integration
  useEffect(() => {
    if (!lesson.vdoCipher || lesson.completed) return;
    let cleanup: (() => void) | undefined;
    let interval: NodeJS.Timeout;

    function attach() {
      const win = window as unknown as {
        VdoPlayer?: {
          getInstance: (frame: HTMLIFrameElement) => {
            video: {
              addEventListener: (event: string, cb: () => void) => void;
              removeEventListener: (event: string, cb: () => void) => void;
            };
          };
        };
      };
      if (win.VdoPlayer && vdoIframeRef.current) {
        try {
          const player = win.VdoPlayer.getInstance(vdoIframeRef.current);
          const onEnded = () => {
            void complete(true, true);
          };
          player.video.addEventListener("ended", onEnded);
          cleanup = () => {
            try {
              player.video.removeEventListener("ended", onEnded);
            } catch {
              // ignore
            }
          };
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }

    if (!attach()) {
      interval = setInterval(() => {
        if (attach()) clearInterval(interval);
      }, 500);
    }

    return () => {
      clearInterval(interval);
      cleanup?.();
    };
  }, [lesson.id, lesson.completed, lesson.vdoCipher, complete]);

  // Video playback controller functions
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      videoRef.current.volume = 1;
      setVolume(1);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
      videoRef.current.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const targetTime = Math.max(0, Math.min(duration, pos * duration));
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleSpeedChange = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    setSpeedMenuOpen(false);
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current
        .requestFullscreen?.()
        .then(() => {
          setIsFullscreen(true);
        })
        .catch(() => {});
    } else {
      document
        .exitFullscreen?.()
        .then(() => {
          setIsFullscreen(false);
        })
        .catch(() => {});
    }
  };

  const togglePiP = () => {
    if (!videoRef.current) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture?.().catch(() => {});
    } else if (document.pictureInPictureEnabled) {
      videoRef.current.requestPictureInPicture?.().catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Format lesson duration for display
  const durationMinutes = useMemo(() => {
    if (lesson.duration && lesson.duration > 0) {
      return Math.max(1, Math.round(lesson.duration / 60));
    }
    return 12; // default placeholder matching design
  }, [lesson.duration]);

  const saveNotes = () => {
    try {
      localStorage.setItem(userScopedKey, notes);
      setSaveStatus("saved");
      toast.success("Notes saved for this lesson.");
    } catch {
      toast.error("Could not save note to browser storage.");
    }
  };

  const toggleCaptions = () => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    if (tracks && tracks.length > 0) {
      const next = !captionsOn;
      tracks[0].mode = next ? "showing" : "hidden";
      setCaptionsOn(next);
      toast.info(next ? "Captions enabled" : "Captions disabled");
    } else {
      toast.info("No captions available for this preview track.");
    }
  };

  const handleScrubberKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!videoRef.current || duration <= 0) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = Math.min(duration, currentTime + 5);
      videoRef.current.currentTime = next;
      setCurrentTime(next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = Math.max(0, currentTime - 5);
      videoRef.current.currentTime = prev;
      setCurrentTime(prev);
    }
  };

  return (
    <div className="video-learning-page">
      {/* =====================================================================
          TWO-COLUMN MAIN PORTAL BODY
          ===================================================================== */}
      <div className="vlp-portal-body">
        {/* ===================================================================
            LEFT SIDEBAR: CURRICULUM, PROGRESS & EXPIRY
            =================================================================== */}
        <aside className="vlp-sidebar" aria-label="Course curriculum">
          {/* Back link */}
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="vlp-back-link"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <ArrowLeft size={16} />
              <span>Back to my courses</span>
            </button>
          ) : (
            <Link href="/dashboard" className="vlp-back-link">
              <ArrowLeft size={16} />
              <span>Back to my courses</span>
            </Link>
          )}

          {/* Course card banner with candlestick/artwork */}
          <div className="vlp-course-card">
            {course.thumbnail ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={course.thumbnail} alt={course.title} className="vlp-course-card-bg" />
            ) : (
              <div className="vlp-course-card-artwork">
                <CourseArtwork
                  kind={
                    course.slug.includes("price")
                      ? "structure"
                      : course.slug.includes("risk")
                        ? "risk"
                        : "foundations"
                  }
                />
              </div>
            )}
            <div className="vlp-course-card-gradient" />
            <h2 className="vlp-course-card-title">{course.title}</h2>
          </div>

          {/* Progress bar block */}
          <div className="vlp-progress-block">
            <div className="vlp-progress-labels">
              <span>{course.progress}% complete</span>
              <span>
                {completedLessonsCount} of {totalLessons} lessons
              </span>
            </div>
            <div className="vlp-progress-track">
              <div className="vlp-progress-bar" style={{ width: `${course.progress}%` }} />
            </div>
          </div>

          {/* Course content title */}
          <span className="vlp-content-label">Course content</span>

          {/* Modules and lessons tree */}
          <div className="vlp-curriculum-tree">
            {course.modules.map((module, mIdx) => {
              const isCollapsed = !!collapsedModules[module.id];
              return (
                <div className="vlp-module-accordion" key={module.id}>
                  <button
                    type="button"
                    className="vlp-module-header"
                    onClick={() =>
                      setCollapsedModules({
                        ...collapsedModules,
                        [module.id]: !isCollapsed,
                      })
                    }
                    aria-expanded={!isCollapsed}
                  >
                    <div className="vlp-module-title-box">
                      <strong>Module {mIdx + 1}</strong>
                      <span>{module.title}</span>
                    </div>
                    <CaretDown
                      size={15}
                      className={`vlp-module-chevron ${isCollapsed ? "" : "is-open"}`}
                    />
                  </button>

                  {!isCollapsed && (
                    <div className="vlp-lesson-list">
                      {module.lessons.map((item, lIdx) => {
                        const isActive = item.id === lesson.id;
                        const isCompleted = item.completed;
                        const isLocked = !course.owned && !item.preview;
                        const lessonNumber = (lIdx + 1).toString().padStart(2, "0");
                        const itemDurationMin = item.duration
                          ? Math.max(1, Math.round(item.duration / 60))
                          : 10 + (lIdx % 5) * 2;

                        if (isLocked) {
                          return (
                            <div
                              key={item.id}
                              className="vlp-lesson-item is-locked"
                              aria-disabled="true"
                              style={{ opacity: 0.65, cursor: "not-allowed" }}
                            >
                              <div className="vlp-lesson-icon is-locked" aria-label="Locked lesson">
                                <LockSimple size={13} />
                              </div>
                              <span className="vlp-lesson-name">
                                {lessonNumber} {item.title}
                              </span>
                              <span
                                style={{
                                  fontSize: "11px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "color-mix(in srgb, var(--surface) 90%, #000)",
                                  color: "var(--muted)",
                                  border: "1px solid var(--border)",
                                }}
                              >
                                Locked
                              </span>
                            </div>
                          );
                        }

                        return (
                          <Link
                            key={item.id}
                            href={`/learn/${course.slug}/${item.id}`}
                            onClick={(e) => {
                              if (onLessonChange) {
                                e.preventDefault();
                                onLessonChange(item.id);
                              }
                            }}
                            className={`vlp-lesson-item ${isActive ? "is-active" : ""}`}
                            aria-current={isActive ? "page" : undefined}
                          >
                            <div
                              className={`vlp-lesson-icon ${
                                isActive
                                  ? "is-active"
                                  : isCompleted
                                    ? "is-completed"
                                    : "is-unwatched"
                              }`}
                            >
                              {isCompleted ? (
                                <Check size={14} weight="bold" />
                              ) : isActive ? (
                                <Play size={11} weight="fill" />
                              ) : (
                                <PlayCircle size={15} />
                              )}
                            </div>
                            <span className="vlp-lesson-name">
                              {lessonNumber} {item.title}
                            </span>
                            <span className="vlp-lesson-duration">{itemDurationMin} min</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Access Validity / Calendar pin at bottom */}
          <div className="vlp-sidebar-footer">
            <CalendarBlank size={15} />
            <span>
              {course.accessExpiresAt
                ? `Access until ${accessExpiryLabel(course.accessExpiresAt)}`
                : "Standard enrolled access"}
            </span>
          </div>
        </aside>

        {/* ===================================================================
            RIGHT MAIN AREA: VIDEO PLAYER & DETAILS
            =================================================================== */}
        <section className="vlp-main" aria-label="Lesson video and details">
          {/* Breadcrumbs */}
          <nav className="vlp-breadcrumbs" aria-label="Breadcrumbs">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  font: "inherit",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                My learning
              </button>
            ) : (
              <Link href="/dashboard">My learning</Link>
            )}
            <span>&gt;</span>
            <span>{course.title}</span>
          </nav>

          {/* Lesson Header Row */}
          <div className="vlp-lesson-header">
            <div>
              <h1>{lesson.title}</h1>
              <div className="vlp-lesson-meta">
                Lesson {currentIndex + 1} of {totalLessons} · {durationMinutes} min
              </div>
            </div>

            <div className="vlp-secure-badge">
              <ShieldCheck size={16} weight="fill" />
              <span>Secure playback</span>
            </div>
          </div>

          {/* =================================================================
              VIDEO PLAYER CONTAINER
              ================================================================= */}
          <div
            ref={playerContainerRef}
            className={`vlp-player-container ${isPlaying ? "is-playing" : ""}`}
          >
            {/* DRM / VdoCipher Player */}
            {lesson.vdoCipher ? (
              <>
                <iframe
                  ref={vdoIframeRef}
                  title={lesson.title}
                  src={`https://player.vdocipher.com/v2/?otp=${lesson.vdoCipher.otp}&playbackInfo=${lesson.vdoCipher.playbackInfo}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    border: 0,
                  }}
                  allow="encrypted-media; fullscreen; autoplay"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
                <Script src="https://player.vdocipher.com/v2/api.js" strategy="afterInteractive" />
              </>
            ) : (
              /* Custom HTML5 Video Player */
              <>
                {/* Brand watermark */}
                <div className="vlp-watermark">
                  <BullMark width={20} height={20} />
                  <span>indianXtrade{user?.email ? ` · ${user.email}` : ""}</span>
                </div>

                {/* Local demo badge if applicable */}
                {lesson.isDemo && (
                  <div className="vlp-demo-badge">Interactive Demonstration Video</div>
                )}

                {/* Video element */}
                <video
                  ref={videoRef}
                  key={lesson.id}
                  className="vlp-video-element"
                  playsInline
                  preload="metadata"
                  src={lesson.videoUrl || ""}
                  poster={course.thumbnail || undefined}
                  onClick={togglePlay}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      setCurrentTime(videoRef.current.currentTime);
                      setDuration(videoRef.current.duration || 0);
                    }
                  }}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      setDuration(videoRef.current.duration || 0);
                    }
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => {
                    setIsPlaying(false);
                    if (!lesson.completed) void complete(true, true);
                  }}
                  onError={() => setVideoError(true)}
                >
                  <track
                    kind="captions"
                    src="/demo-captions.vtt"
                    srcLang="en"
                    label="English captions"
                    default
                  />
                </video>

                {/* Video Error Overlay */}
                {videoError && (
                  <div
                    className="vlp-video-error-overlay"
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0, 0, 0, 0.88)",
                      zIndex: 10,
                      padding: "20px",
                    }}
                    role="alert"
                  >
                    <div style={{ textAlign: "center", maxWidth: "420px" }}>
                      <p
                        style={{
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: "16px",
                          margin: "0 0 6px",
                        }}
                      >
                        Video stream unavailable
                      </p>
                      <p style={{ color: "var(--muted)", fontSize: "13px", margin: "0 0 16px" }}>
                        We couldn&apos;t load the video player stream for this lesson. Please check
                        your network or retry.
                      </p>
                      <button
                        type="button"
                        className="button button-primary button-sm"
                        onClick={() => {
                          setVideoError(false);
                          if (videoRef.current) {
                            videoRef.current.load();
                          }
                        }}
                      >
                        Retry video
                      </button>
                    </div>
                  </div>
                )}

                {/* Center Big Play Button (shown when paused) */}
                {!isPlaying && !videoError && (
                  <button
                    type="button"
                    className="vlp-center-play-wrap"
                    onClick={togglePlay}
                    aria-label="Play video"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <div className="vlp-center-play-btn" title="Play video">
                      <Play size={28} weight="fill" />
                    </div>
                  </button>
                )}

                {/* Bottom Controls Overlay Bar */}
                {!videoError && (
                  <div className="vlp-player-controls-overlay">
                    {/* Scrubber timeline */}
                    <div
                      className="vlp-scrubber-track"
                      onClick={handleSeek}
                      onKeyDown={handleScrubberKeyDown}
                      tabIndex={0}
                      role="slider"
                      aria-label="Video seek scrubber"
                      aria-valuemin={0}
                      aria-valuemax={Math.round(duration || lesson.duration || 0)}
                      aria-valuenow={Math.round(currentTime)}
                      aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration || lesson.duration || 0)}`}
                    >
                      <div
                        className="vlp-scrubber-fill"
                        style={{
                          width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                        }}
                      >
                        <div className="vlp-scrubber-thumb" />
                      </div>
                    </div>

                    {/* Bottom controls row */}
                    <div className="vlp-controls-row">
                      <div className="vlp-controls-left">
                        {/* Play/Pause */}
                        <button
                          type="button"
                          className="vlp-ctrl-btn"
                          onClick={togglePlay}
                          aria-label={isPlaying ? "Pause" : "Play"}
                        >
                          {isPlaying ? (
                            <Pause size={18} weight="fill" />
                          ) : (
                            <Play size={18} weight="fill" />
                          )}
                        </button>

                        {/* Mute/Volume */}
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <button
                            type="button"
                            className="vlp-ctrl-btn"
                            onClick={toggleMute}
                            aria-label={isMuted ? "Unmute" : "Mute"}
                          >
                            {isMuted || volume === 0 ? (
                              <SpeakerSimpleSlash size={18} />
                            ) : (
                              <SpeakerHigh size={18} />
                            )}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                            aria-label="Volume slider"
                            style={{
                              width: "55px",
                              height: "4px",
                              accentColor: "#00df8f",
                              cursor: "pointer",
                            }}
                          />
                        </div>

                        {/* Time display */}
                        <span className="vlp-time-readout">
                          {formatTime(currentTime)} /{" "}
                          {duration > 0
                            ? formatTime(duration)
                            : lesson.duration
                              ? formatTime(lesson.duration)
                              : "--:--"}
                        </span>
                      </div>

                      <div className="vlp-controls-right">
                        {/* CC Toggle */}
                        <button
                          type="button"
                          className={`vlp-ctrl-btn ${captionsOn ? "is-active" : ""}`}
                          onClick={toggleCaptions}
                          title={captionsOn ? "Disable captions" : "Enable captions"}
                          aria-label="Toggle captions"
                          aria-pressed={captionsOn}
                        >
                          <ClosedCaptioning size={18} weight={captionsOn ? "fill" : "regular"} />
                        </button>

                        {/* Speed dropdown */}
                        <div className="vlp-speed-dropdown">
                          <button
                            type="button"
                            className="vlp-speed-btn"
                            onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
                            aria-label="Playback speed"
                          >
                            <span>{playbackSpeed}x</span>
                            <CaretDown size={11} />
                          </button>

                          {speedMenuOpen && (
                            <div className="vlp-speed-menu">
                              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  className={`vlp-speed-option ${
                                    playbackSpeed === s ? "is-active" : ""
                                  }`}
                                  onClick={() => handleSpeedChange(s)}
                                >
                                  {s}x
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* PiP */}
                        <button
                          type="button"
                          className="vlp-ctrl-btn"
                          onClick={togglePiP}
                          title="Picture-in-picture"
                          aria-label="Picture in picture"
                        >
                          <PictureInPicture size={18} />
                        </button>

                        {/* Fullscreen */}
                        <button
                          type="button"
                          className="vlp-ctrl-btn"
                          onClick={toggleFullscreen}
                          title="Fullscreen"
                          aria-label="Fullscreen"
                        >
                          {isFullscreen ? <CornersIn size={18} /> : <CornersOut size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* =================================================================
              LESSON NAVIGATION & ACTION BUTTONS BAR
              ================================================================= */}
          <div className="vlp-nav-actions">
            {/* Previous lesson */}
            {prevLesson ? (
              onLessonChange ? (
                <button
                  type="button"
                  onClick={() => onLessonChange(prevLesson.id)}
                  className="vlp-prev-btn"
                >
                  <ArrowLeft size={16} />
                  <span>Previous lesson</span>
                </button>
              ) : (
                <Link href={`/learn/${course.slug}/${prevLesson.id}`} className="vlp-prev-btn">
                  <ArrowLeft size={16} />
                  <span>Previous lesson</span>
                </Link>
              )
            ) : (
              <button type="button" className="vlp-prev-btn is-disabled" disabled>
                <ArrowLeft size={16} />
                <span>Previous lesson</span>
              </button>
            )}

            {/* Mark complete & continue */}
            <button
              type="button"
              className={`vlp-complete-btn ${lesson.completed ? "is-completed" : ""}`}
              disabled={pending}
              onClick={() => void complete(undefined, !lesson.completed)}
            >
              {pending ? (
                <span>Saving…</span>
              ) : lesson.completed ? (
                <>
                  <CheckCircle size={17} weight="fill" />
                  <span>Completed · Mark incomplete</span>
                </>
              ) : (
                <>
                  <span>Mark complete &amp; continue</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>

          {/* =================================================================
              LESSON TABS BAR
              ================================================================= */}
          <div className="vlp-tabs-bar" role="tablist" aria-label="Lesson content sections">
            <button
              type="button"
              id="tab-overview"
              role="tab"
              aria-controls="panel-overview"
              aria-selected={activeTab === "overview"}
              className={`vlp-tab-btn ${activeTab === "overview" ? "is-active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              id="tab-notes"
              role="tab"
              aria-controls="panel-notes"
              aria-selected={activeTab === "notes"}
              className={`vlp-tab-btn ${activeTab === "notes" ? "is-active" : ""}`}
              onClick={() => setActiveTab("notes")}
            >
              My notes
            </button>
            <button
              type="button"
              id="tab-resources"
              role="tab"
              aria-controls="panel-resources"
              aria-selected={activeTab === "resources"}
              className={`vlp-tab-btn ${activeTab === "resources" ? "is-active" : ""}`}
              onClick={() => setActiveTab("resources")}
            >
              Resources
              {lesson.resources && lesson.resources.length > 0
                ? ` (${lesson.resources.length})`
                : ""}
            </button>
          </div>

          {/* =================================================================
              CARD CONTENT PANEL
              ================================================================= */}
          <div className="vlp-card-panel">
            {activeTab === "overview" && (
              <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
                <h3 className="vlp-summary-title">Lesson summary</h3>
                <p className="vlp-summary-text">
                  {lesson.content ||
                    "In this lesson you'll learn what drives market movement, how market structure forms through highs and lows, and why understanding structure is essential for making better trading decisions."}
                </p>

                {lesson.outcomes && lesson.outcomes.length > 0 && (
                  <>
                    <h3 className="vlp-learn-title">What you&apos;ll learn</h3>
                    <div className="vlp-takeaways-grid">
                      {lesson.outcomes.map((outcome, idx) => (
                        <div key={idx} className="vlp-takeaway-item">
                          <div className="vlp-takeaway-icon">
                            <Check size={12} weight="bold" />
                          </div>
                          <span>{outcome}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "notes" && (
              <div
                id="panel-notes"
                role="tabpanel"
                aria-labelledby="tab-notes"
                className="vlp-notes-panel"
              >
                <textarea
                  className="vlp-notes-textarea"
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setSaveStatus("saving");
                  }}
                  placeholder="Type your personal observations, key levels, or setup rules here... Notes are stored privately on this device for your account."
                />
                <div className="vlp-notes-actions">
                  <span
                    style={{
                      fontSize: "12px",
                      color:
                        saveStatus === "saved" && notes.length > 0
                          ? "var(--accent, #00df8f)"
                          : "#9ca3af",
                    }}
                  >
                    {saveStatus === "saving"
                      ? "Saving changes…"
                      : saveStatus === "saved" && notes.length > 0
                        ? "✓ Saved to this device"
                        : `${notes.length} characters`}
                  </span>
                  <button
                    type="button"
                    className="button button-primary button-sm"
                    onClick={saveNotes}
                  >
                    <NotePencil size={15} />
                    <span>Save notes</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === "resources" && (
              <div
                id="panel-resources"
                role="tabpanel"
                aria-labelledby="tab-resources"
                className="vlp-resources-panel"
              >
                {!lesson.resources || lesson.resources.length === 0 ? (
                  <div
                    style={{
                      padding: "36px 16px",
                      textAlign: "center",
                      color: "var(--muted)",
                      fontSize: "14px",
                    }}
                  >
                    <p style={{ margin: 0 }}>No downloadable resources for this lesson yet.</p>
                  </div>
                ) : (
                  lesson.resources.map((res) => (
                    <div key={res.id} className="vlp-resource-item">
                      <div className="vlp-resource-info">
                        <FilePdf size={28} color="#00df8f" />
                        <div>
                          <strong>{res.title}</strong>
                          {res.size && <small>{res.size}</small>}
                        </div>
                      </div>
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="vlp-resource-dl-btn"
                        download
                      >
                        <DownloadSimple size={15} /> Download
                      </a>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
