"use client";
import { useEffect, useRef, useState } from "react";
import { useHydrated } from "../lib/use-hydrated";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PurchaseCourse, PurchaseLessonContent } from "../../shared/purchase";
import { accessExpiryLabel } from "../../shared/course-access";
export function PurchasePlayer({
  course,
  lesson,
}: {
  course: PurchaseCourse;
  lesson: PurchaseLessonContent;
}) {
  const router = useRouter();
  const interactive = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
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
  const lessons = course.modules.flatMap((m) => m.lessons);
  const index = lessons.findIndex((l) => l.id === lesson.id);
  async function complete() {
    setPending(true);
    setError("");
    try {
      const r = await fetch("/api/purchase/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id, completed: !lesson.completed }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Progress could not be saved.");
      toast.success(lesson.completed ? "Lesson marked incomplete." : "Lesson completed.");
      router.refresh();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Progress could not be saved.";
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }
  return (
    <main id="main-content" className="container purchase-classroom">
      <aside className="purchase-sidebar">
        <Link className="text-link" href="/dashboard">
          My courses
        </Link>
        <h2>{course.title}</h2>
        {course.accessExpiresAt && <p>Access until {accessExpiryLabel(course.accessExpiresAt)}</p>}
        <p>{course.progress}% complete</p>
        <progress aria-label="Overall course progress" max={100} value={course.progress} />
        {course.modules.map((module) => (
          <section key={module.id}>
            <h3>{module.title}</h3>
            <ol>
              {module.lessons.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/learn/${course.slug}/${item.id}`}
                    aria-current={lesson.id === item.id ? "page" : undefined}
                  >
                    {item.completed ? "✓ " : ""}
                    {item.title}
                    {!course.owned && !item.preview ? " · Locked" : ""}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </aside>
      <section className="purchase-lesson">
        <div className="demo-banner">
          LOCAL DEMO: public placeholder video, not paid instructor content
        </div>
        <h1>{lesson.title}</h1>
        {lesson.videoUrl && !videoError ? (
          <video
            ref={videoRef}
            key={lesson.id}
            controls
            playsInline
            preload="metadata"
            onError={() => setVideoError(true)}
            src={lesson.videoUrl}
          >
            <track
              kind="captions"
              src="/demo-captions.vtt"
              srcLang="en"
              label="Placeholder video description"
              default
            />
          </video>
        ) : (
          <p role="status">
            The sample video could not load. You can read the lesson notes and continue below.
          </p>
        )}
        <h2>Lesson notes</h2>
        <p className="purchase-notes">{lesson.content}</p>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {course.owned ? (
          <button
            className="button button-primary"
            disabled={pending || !interactive}
            onClick={() => void complete()}
          >
            {pending ? "Saving…" : lesson.completed ? "Mark as incomplete" : "Mark as complete"}
          </button>
        ) : (
          <Link className="button button-primary" href={`/checkout/${course.id}`}>
            Buy course to continue
          </Link>
        )}
        <nav className="gateway-actions" aria-label="Lesson navigation">
          {index > 0 && (
            <Link
              className="button button-secondary"
              href={`/learn/${course.slug}/${lessons[index - 1].id}`}
            >
              Previous lesson
            </Link>
          )}
          {index < lessons.length - 1 && (
            <Link
              className="button button-secondary"
              href={`/learn/${course.slug}/${lessons[index + 1].id}`}
            >
              Next lesson
            </Link>
          )}
        </nav>
      </section>
    </main>
  );
}
