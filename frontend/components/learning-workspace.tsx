"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  LockSimple,
  List,
  Play,
  ShieldCheck,
  X,
} from "@phosphor-icons/react";
import type { CourseView, LessonView, PlaybackView } from "../../shared/learning";
import { learningApi, lessonTime, LearningError } from "../lib/learning-api";
import { ProtectedPlayer } from "./protected-player";

export function LearningWorkspace({
  slug,
  initialLesson,
}: {
  slug: string;
  initialLesson?: string;
}) {
  const router = useRouter();
  const [course, setCourse] = useState<CourseView | null>(null);
  const [selected, setSelected] = useState("");
  const [playback, setPlayback] = useState<PlaybackView | null>(null);
  const [notes, setNotes] = useState<{
    notes: string;
    resources: { id: string; title: string; content: string }[];
  } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [autoNext, setAutoNext] = useState(false);
  useEffect(() => {
    let active = true;
    learningApi<{ course: CourseView }>(`course?slug=${encodeURIComponent(slug)}`)
      .then(({ course: c }) => {
        if (!active) return;
        setCourse(c);
        const all = c.modules.flatMap((m) => m.lessons);
        setSelected(
          all.some((l) => l.id === initialLesson)
            ? initialLesson!
            : (c.resumeLessonId ?? all[0]?.id ?? ""),
        );
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [slug, initialLesson]);
  const lessons = course?.modules.flatMap((m) => m.lessons) ?? [];
  const lesson = lessons.find((l) => l.id === selected);
  const canWatch = !!course?.owned || !!lesson?.preview;
  useEffect(() => {
    let active = true;
    if (!selected || !canWatch) return;
    learningApi<{ notes: string; resources: { id: string; title: string; content: string }[] }>(
      `lesson?id=${selected}`,
    )
      .then((value) => {
        if (active) setNotes(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [selected, canWatch]);
  function choose(next: LessonView) {
    if (pending) return;
    setPlayback(null);
    setNotes(null);
    setError("");
    setSelected(next.id);
    setDrawer(false);
    window.history.replaceState(null, "", `/learn/${slug}?lesson=${next.id}`);
  }
  const start = useCallback(async () => {
    if (!selected) return;
    setPending(true);
    setError("");
    setPlayback(null);
    try {
      const value = await learningApi<PlaybackView>("playback", { lessonId: selected });
      setPlayback(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Playback could not start.");
    } finally {
      setPending(false);
    }
  }, [selected]);
  async function complete() {
    if (!lesson) return;
    setPending(true);
    try {
      await learningApi("complete", { lessonId: lesson.id, completed: !lesson.completed });
      setCourse((current) =>
        current
          ? {
              ...current,
              modules: current.modules.map((m) => ({
                ...m,
                lessons: m.lessons.map((l) =>
                  l.id === lesson.id ? { ...l, completed: !l.completed } : l,
                ),
              })),
            }
          : current,
      );
    } catch (e) {
      if (e instanceof LearningError && e.status === 401)
        router.push(`/login?next=${encodeURIComponent(`/learn/${slug}?lesson=${selected}`)}`);
      else setError(e instanceof Error ? e.message : "Completion could not save.");
    } finally {
      setPending(false);
    }
  }
  async function ended() {
    const next = lessons[lessons.findIndex((l) => l.id === selected) + 1];
    if (autoNext && next && (course?.owned || next.preview)) {
      choose(next);
      setPending(true);
      try {
        const value = await learningApi<PlaybackView>("playback", { lessonId: next.id });
        setPlayback({ ...value, autoplay: true });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "The next lesson could not start.");
      } finally {
        setPending(false);
      }
    }
  }
  const done = lessons.filter((l) => l.completed).length;
  const next = lessons[lessons.findIndex((l) => l.id === selected) + 1];
  return (
    <main id="main-content" className="learning-workspace container">
      <header className="learning-workspace-heading">
        <div>
          <Link className="text-link" href="/learn">
            <ArrowLeft size={16} /> My learning
          </Link>
          <h1>{course?.title ?? "Your classroom"}</h1>
          <p>
            {course
              ? `${course.language} · ${lessons.length} lessons · ${done} complete`
              : "Loading the published curriculum…"}
          </p>
        </div>
        <button
          className="button button-secondary learning-curriculum-toggle"
          onClick={() => setDrawer(!drawer)}
          aria-expanded={drawer}
          aria-controls="lesson-sidebar"
        >
          <List size={18} /> Lessons
        </button>
      </header>
      {!course ? (
        <div className="learning-empty" role={error ? "alert" : "status"}>
          <p>{error || "Loading your course…"}</p>
          {error && (
            <Link className="text-link" href="/courses">
              Browse available courses
            </Link>
          )}
        </div>
      ) : (
        <div className="learning-layout">
          <aside
            id="lesson-sidebar"
            className={`learning-sidebar ${drawer ? "is-open" : ""}`}
            aria-label="Course curriculum"
          >
            <div className="learning-sidebar-heading">
              <h2>Course content</h2>
              <button
                className="icon-button learning-drawer-close"
                onClick={() => setDrawer(false)}
                aria-label="Close lesson list"
              >
                <X size={18} />
              </button>
            </div>
            <progress
              aria-label="Course completion"
              max={Math.max(1, lessons.length)}
              value={done}
            />
            {course.modules.map((m, i) => (
              <section key={m.id}>
                <h3>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {m.title}
                </h3>
                <ol>
                  {m.lessons.map((l) => (
                    <li key={l.id}>
                      <button
                        className={l.id === selected ? "is-selected" : ""}
                        aria-current={l.id === selected ? "true" : undefined}
                        onClick={() => choose(l)}
                        disabled={pending}
                      >
                        {l.completed ? (
                          <CheckCircle size={17} />
                        ) : course.owned || l.preview ? (
                          <Play size={17} />
                        ) : (
                          <LockSimple size={17} />
                        )}
                        <span>
                          {l.title}
                          <small>
                            {lessonTime(l.duration)} {l.preview ? "· Preview" : ""}
                          </small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </aside>
          <section className="learning-main" aria-label="Selected lesson">
            {lesson ? (
              <>
                <div className="learning-lesson-heading">
                  <span className="auth-section-label">
                    {lesson.preview ? "Preview lesson" : "Course lesson"}
                  </span>
                  <h2>{lesson.title}</h2>
                </div>
                {error && (
                  <p className="auth-error" role="alert">
                    {error}
                  </p>
                )}
                {!canWatch ? (
                  <div className="learning-player-placeholder">
                    <LockSimple size={34} />
                    <h3>This lesson is reserved for enrolled learners.</h3>
                    <p>
                      Sign in if you already have access. Payments are not open in this preview.
                    </p>
                    <Link
                      className="button button-primary"
                      href={`/login?next=${encodeURIComponent(`/learn/${slug}?lesson=${selected}`)}`}
                    >
                      Sign in to your account
                    </Link>
                  </div>
                ) : playback ? (
                  <ProtectedPlayer
                    key={playback.leaseId ?? playback.otp}
                    playback={playback}
                    title={lesson.title}
                    onEnded={ended}
                  />
                ) : (
                  <div className="learning-player-placeholder">
                    <ShieldCheck size={34} />
                    <h3>Ready when you are.</h3>
                    <p>
                      Start your protected lesson. Signed-in playback displays your account email as
                      a watermark.
                    </p>
                    <button className="button button-primary" disabled={pending} onClick={start}>
                      <Play size={18} />
                      {pending ? "Preparing secure playback…" : "Start lesson"}
                    </button>
                  </div>
                )}
                {canWatch && (
                  <div className="learning-lesson-controls">
                    <button
                      className="button button-secondary"
                      disabled={pending}
                      onClick={complete}
                    >
                      <CheckCircle size={18} />
                      {lesson.completed ? "Mark incomplete" : "Mark as complete"}
                    </button>
                    <label>
                      <input
                        type="checkbox"
                        checked={autoNext}
                        onChange={(e) => setAutoNext(e.target.checked)}
                      />{" "}
                      Auto-play next lesson
                    </label>
                    <button
                      className="text-link"
                      disabled={!next || pending}
                      onClick={() => next && choose(next)}
                    >
                      Next lesson <ArrowRight size={16} />
                    </button>
                  </div>
                )}
                {playback && (
                  <button className="text-link learning-reload" disabled={pending} onClick={start}>
                    Reload protected player
                  </button>
                )}
                {canWatch && (
                  <section className="learning-notes">
                    <h2>Lesson notes</h2>
                    {notes ? (
                      <>
                        <p className="learning-note-content">
                          {notes.notes || "No notes have been published for this lesson."}
                        </p>
                        {notes.resources.map((r) => (
                          <details key={r.id}>
                            <summary>{r.title}</summary>
                            <p className="learning-note-content">{r.content}</p>
                          </details>
                        ))}
                      </>
                    ) : (
                      <p role="status">Loading lesson notes…</p>
                    )}
                    <p className="learning-caption">
                      Notes are provided for viewing in your classroom. Completion checkmarks and
                      watched time are recorded separately.
                    </p>
                  </section>
                )}
              </>
            ) : (
              <div className="learning-empty">
                <h2>The curriculum is being prepared.</h2>
                <p>No lessons have been published for this course yet.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
