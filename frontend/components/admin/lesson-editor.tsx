"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, LinkSimple, UploadSimple } from "@phosphor-icons/react";
import { adminApi, formText } from "../../lib/admin-api";
import type { AdminCourse, AdminLesson, AdminModule } from "../../../shared/admin";

export type Run = (action: string, data: unknown) => Promise<boolean>;

export function LessonList({
  module,
  course,
  pending,
  run,
  reorder,
}: {
  module: AdminModule;
  course: AdminCourse;
  pending: boolean;
  run: Run;
  reorder: (
    kind: "modules" | "lessons",
    ids: string[],
    from: number,
    to: number,
    moduleId?: string,
  ) => Promise<void>;
}) {
  const lessons = [...module.lessons].sort((a, b) => a.position - b.position);
  return (
    <div>
      {lessons.map((l, index) => (
        <div
          key={l.id}
          draggable={!pending}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.setData("text/plain", `lesson:${l.id}`);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const [type, id] = e.dataTransfer.getData("text/plain").split(":");
            if (type === "lesson")
              void reorder(
                "lessons",
                lessons.map((x) => x.id),
                lessons.findIndex((x) => x.id === id),
                index,
                module.id,
              );
          }}
        >
          <div className="admin-lesson-row">
            <span>
              {String(index + 1).padStart(2, "0")} · {l.title}
            </span>
            <span className="admin-badge">{l.published ? "Published" : "Draft"}</span>
            <button
              className="icon-button"
              aria-label={`Move lesson ${l.title} up`}
              disabled={pending || index === 0}
              onClick={() =>
                reorder(
                  "lessons",
                  lessons.map((x) => x.id),
                  index,
                  index - 1,
                  module.id,
                )
              }
            >
              <ArrowUp size={16} />
            </button>
            <button
              className="icon-button"
              aria-label={`Move lesson ${l.title} down`}
              disabled={pending || index === lessons.length - 1}
              onClick={() =>
                reorder(
                  "lessons",
                  lessons.map((x) => x.id),
                  index,
                  index + 1,
                  module.id,
                )
              }
            >
              <ArrowDown size={16} />
            </button>
            <button
              className="text-link"
              disabled={pending}
              onClick={() => {
                if (
                  window.confirm(
                    "Permanently delete this lesson? Learner history prevents deletion.",
                  )
                )
                  void run("lesson_delete", {
                    courseId: course.id,
                    moduleId: module.id,
                    lessonId: l.id,
                    version: course.version,
                  });
              }}
            >
              Delete
            </button>
          </div>
          <LessonEditor
            key={`${l.id}:${course.version}`}
            lesson={l}
            moduleId={module.id}
            course={course}
            pending={pending}
            run={run}
          />
        </div>
      ))}
      <LessonEditor
        key={`new:${course.version}`}
        moduleId={module.id}
        course={course}
        pending={pending}
        run={run}
      />
    </div>
  );
}

export function LessonEditor({
  lesson,
  moduleId,
  course,
  pending,
  run,
}: {
  lesson?: AdminLesson;
  moduleId: string;
  course: AdminCourse;
  pending: boolean;
  run: Run;
}) {
  const [videoId, setVideoId] = useState(lesson?.lesson_assets?.provider_video_id ?? "");
  const [duration, setDuration] = useState(lesson?.duration_seconds ?? 0);
  const [status, setStatus] = useState(lesson?.lesson_assets?.provider_status ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [resources, setResources] = useState(
    lesson?.lesson_resources.map((r) => ({ title: r.title, content: r.content })) ?? [],
  );
  async function check(id = videoId) {
    setBusy(true);
    setError("");
    try {
      const d = await adminApi<{ status: string; duration: number }>("video-status", {
        videoId: id,
      });
      setStatus(d.status);
      if (d.duration) setDuration(d.duration);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Video status unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("video/") || file.size > 5 * 1024 ** 3) {
      setError("Choose a video smaller than 5 GB.");
      return;
    }
    setBusy(true);
    setError("");
    setUploadProgress(0);
    try {
      const d = await adminApi<{
        videoId: string;
        uploadLink: string;
        fields: Record<string, string>;
      }>("video-upload", { title: file.name.slice(0, 180) });
      setVideoId(d.videoId);
      const form = new FormData();
      for (const [k, v] of Object.entries(d.fields)) form.append(k, v);
      form.append("success_action_status", "201");
      form.append("file", file);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", d.uploadLink);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(
                new Error("Video upload failed. Retry or upload through VdoCipher's dashboard."),
              );
        xhr.onerror = () => reject(new Error("The upload connection failed."));
        xhr.send(form);
      });
      setStatus("Processing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="admin-lesson-editor" open={Boolean(lesson)}>
      <summary>
        <span>{lesson ? "Edit lesson" : "Add lesson"}</span>
        {lesson && <small>{moduleId ? "Curriculum lesson" : "New lesson"}</small>}
      </summary>
      <form
        className="admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await run("lesson_save", {
            courseId: course.id,
            version: course.version,
            moduleId,
            id: lesson?.id,
            title: formText(f, "title"),
            duration_seconds: duration,
            videoId,
            notes: formText(f, "notes"),
            is_preview: f.get("preview") === "on",
            published: f.get("published") === "on",
            resources,
          });
        }}
      >
        <label>
          Lesson title
          <input name="title" required minLength={2} maxLength={180} defaultValue={lesson?.title} />
        </label>
        <div className="admin-video-section">
          <span className="admin-field-label">Lesson video</span>
          <div className="admin-video-tabs">
            <button type="button" className="is-active">
              <UploadSimple size={16} /> Upload video
            </button>
            <button type="button">
              <LinkSimple size={16} /> Use video ID
            </button>
          </div>
          <div className="admin-upload-zone">
            <UploadSimple size={28} />
            <strong>
              Drag a video here, or <span>browse files</span>
            </strong>
            <small>Video will be processed for secure playback.</small>
          </div>
        </div>
        <div className="admin-form-grid">
          <label>
            VdoCipher video ID
            <input
              value={videoId}
              maxLength={128}
              onChange={(e) => setVideoId(e.target.value.trim())}
            />
          </label>
          <label>
            Verified duration (seconds)
            <input
              type="number"
              min="0"
              max="86400"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="admin-actions">
          <button
            type="button"
            className="button button-secondary"
            disabled={busy || !videoId}
            onClick={() => check()}
          >
            Check video status
          </button>
          <label className="button button-secondary admin-upload-label">
            <UploadSimple size={16} /> Choose video file
            <input
              type="file"
              accept="video/*"
              disabled={busy}
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            className="text-link"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const d = await adminApi<{ videoId: string; status: string; duration: number }>(
                  "video-test",
                );
                setVideoId(d.videoId);
                setDuration(d.duration);
                setStatus(d.status);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Test video unavailable.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Use configured test video
          </button>
        </div>
        {busy && (
          <p role="status">
            {uploadProgress ? `Uploading: ${uploadProgress}%` : "Checking video…"}
          </p>
        )}
        {status && (
          <p className="admin-help">
            Provider: {status} · {duration} seconds. A lesson can publish only after the provider
            confirms it is ready.
          </p>
        )}
        {error && (
          <p role="alert" className="auth-error">
            {error}
          </p>
        )}
        <label>
          Lesson notes
          <textarea
            name="notes"
            maxLength={6000}
            rows={5}
            defaultValue={lesson?.lesson_assets?.notes}
          />
        </label>
        {resources.map((r, i) => (
          <div className="admin-resource" key={i}>
            <label>
              Worksheet title
              <input
                value={r.title}
                maxLength={150}
                onChange={(e) =>
                  setResources((a) =>
                    a.map((x, n) => (n === i ? { ...x, title: e.target.value } : x)),
                  )
                }
              />
            </label>
            <label>
              Worksheet text
              <textarea
                value={r.content}
                maxLength={2000}
                rows={3}
                onChange={(e) =>
                  setResources((a) =>
                    a.map((x, n) => (n === i ? { ...x, content: e.target.value } : x)),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="text-link"
              onClick={() => setResources((a) => a.filter((_, n) => n !== i))}
            >
              Remove worksheet
            </button>
          </div>
        ))}
        {resources.length < 3 && (
          <button
            type="button"
            className="text-link"
            onClick={() => setResources((a) => [...a, { title: "", content: "" }])}
          >
            Add text worksheet
          </button>
        )}
        <div className="admin-actions">
          <label className="admin-checkbox">
            <input type="checkbox" name="preview" defaultChecked={lesson?.is_preview} /> Free public
            preview
          </label>
          <label className="admin-checkbox">
            <input type="checkbox" name="published" defaultChecked={lesson?.published} /> Publish
            this lesson
          </label>
        </div>
        <p className="admin-help">
          Published previews are playable without a purchase. Existing consumed video versions
          cannot be replaced; add a new lesson instead. Unpublish a course before removing its final
          published lesson.
        </p>
        <button className="button button-primary" disabled={pending || busy}>
          Save lesson
        </button>
      </form>
    </details>
  );
}
