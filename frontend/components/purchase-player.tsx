"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
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
  const vdoIframeRef = useRef<HTMLIFrameElement>(null);
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
  const complete = useCallback(
    async (explicitValue?: boolean) => {
      const nextCompleted = explicitValue !== undefined ? explicitValue : !lesson.completed;
      if (explicitValue !== undefined && lesson.completed === explicitValue) return;
      setPending(true);
      setError("");
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
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : "Progress could not be saved.";
        setError(message);
        toast.error(message);
      } finally {
        setPending(false);
      }
    },
    [lesson.id, lesson.completed, router],
  );
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
            void complete(true);
          };
          player.video.addEventListener("ended", onEnded);
          cleanup = () => {
            try {
              player.video.removeEventListener("ended", onEnded);
            } catch {}
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
        {lesson.vdoCipher ? (
          <div className="demo-banner">
            DRM PROTECTED LESSON · VdoCipher Streaming
          </div>
        ) : (
          <div className="demo-banner">
            LOCAL DEMO: public placeholder video, not paid instructor content
          </div>
        )}
        <h1>{lesson.title}</h1>
        {lesson.vdoCipher ? (
          <div
            className="vdocipher-embed-container"
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16/9",
              background: "#000",
              borderRadius: "8px",
              overflow: "hidden",
              marginBottom: "1.5rem",
            }}
          >
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
            <Script
              src="https://player.vdocipher.com/v2/api.js"
              strategy="afterInteractive"
            />
          </div>
        ) : lesson.videoUrl && !videoError ? (
          <video
            ref={videoRef}
            key={lesson.id}
            controls
            playsInline
            preload="metadata"
            onError={() => setVideoError(true)}
            onEnded={() => {
              if (!lesson.completed) void complete(true);
            }}
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
