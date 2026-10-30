"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowDown, ArrowUp, Plus, UploadSimple } from "@phosphor-icons/react";
import { adminApi, operation, formText, formNumber, money, when } from "../../lib/admin-api";
import type { AdminCourse, AdminLesson, AdminModule } from "../../../shared/admin";

type Summary = Pick<AdminCourse, "id" | "title" | "slug" | "status" | "price_paise" | "version">;
export function CourseManager() {
  const [items, setItems] = useState<Summary[]>([]);
  const [course, setCourse] = useState<AdminCourse | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function list() {
    const d = await adminApi<{ items: Summary[] }>("courses");
    setItems(d.items);
  }
  useEffect(() => {
    adminApi<{ items: Summary[] }>("courses")
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  async function open(id: string) {
    setError("");
    try {
      setCourse((await adminApi<{ course: AdminCourse }>(`course?id=${id}`)).course);
      setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Course could not load.");
    }
  }
  async function refresh(id: string) {
    await open(id);
    await list();
  }
  if (course || creating)
    return (
      <CourseEditor
        key={course?.id ?? "new"}
        course={course}
        onSaved={refresh}
        onBack={() => {
          setCourse(null);
          setCreating(false);
          void list().catch((e) => setError(e.message));
        }}
      />
    );
  return (
    <section>
      <div className="admin-section-head">
        <div>
          <h2>Courses</h2>
          <p>Create a curriculum, verify its videos and publish when it is ready.</p>
        </div>
        <button className="button button-primary" onClick={() => setCreating(true)}>
          <Plus size={17} /> New course
        </button>
      </div>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading courses…</p>
      ) : items.length ? (
        <div className="admin-table-wrap">
          <table>
            <caption className="sr-only">Course inventory</caption>
            <thead>
              <tr>
                <th>Course</th>
                <th>State</th>
                <th>Base price</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.title}</strong>
                    <small>/{c.slug}</small>
                  </td>
                  <td>
                    <span className="admin-badge">{c.status}</span>
                  </td>
                  <td>{money(c.price_paise)}</td>
                  <td>
                    <button className="text-link" onClick={() => open(c.id)}>
                      Edit curriculum
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-empty">
          <h3>Your first course starts here.</h3>
          <p>
            Add the course details, modules and protected lessons. Drafts are visible only to
            administrators.
          </p>
        </div>
      )}
    </section>
  );
}
function CourseEditor({
  course,
  onSaved,
  onBack,
}: {
  course: AdminCourse | null;
  onSaved: (id: string) => Promise<void>;
  onBack: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("details");
  async function run(action: string, data: unknown) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const d = await operation(action, data);
      const id = d.courseId ?? d.id ?? course?.id;
      if (id) await onSaved(id);
      setMessage(action === "course_state" ? "Course visibility updated." : "Changes saved.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Changes could not save.");
      return false;
    } finally {
      setPending(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await run("course_save", {
      courseId: course?.id,
      version: course?.version,
      title: formText(f, "title"),
      slug: formText(f, "slug"),
      description: formText(f, "description"),
      price_paise: Math.round(formNumber(f, "price") * 100),
      sale_price_paise: formText(f, "sale") ? Math.round(formNumber(f, "sale") * 100) : null,
      level: formText(f, "level"),
      language: formText(f, "language"),
      thumbnail_url: formText(f, "thumbnail"),
      outcomes: formText(f, "outcomes")
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
      audience: formText(f, "audience"),
      prerequisites: formText(f, "prerequisites"),
      artwork: formText(f, "artwork"),
    });
  }
  const modules = [...(course?.modules ?? [])].sort((a, b) => a.position - b.position);
  async function reorder(
    kind: "modules" | "lessons",
    ids: string[],
    from: number,
    to: number,
    moduleId?: string,
  ) {
    if (!course || to < 0 || to >= ids.length || from === to) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    await run("reorder", {
      courseId: course.id,
      version: course.version,
      kind,
      moduleId,
      ids: next,
    });
  }
  return (
    <section className="admin-editor">
      <button className="text-link" onClick={onBack}>
        <ArrowLeft size={16} /> All courses
      </button>
      <div className="admin-section-head">
        <div>
          <h2>{course?.title ?? "New course"}</h2>
          <p>
            {course
              ? `${course.status} · Updated ${when(course.updated_at)}`
              : "Start with accurate course information. New courses are drafts."}
          </p>
        </div>
        {course && (
          <div className="admin-actions">
            <Link className="button button-secondary" href={`/learn/${course.slug}`}>
              View classroom
            </Link>
            <button
              className="button button-primary"
              disabled={pending}
              onClick={() =>
                run("course_state", {
                  courseId: course.id,
                  version: course.version,
                  status: course.status === "published" ? "draft" : "published",
                })
              }
            >
              {course.status === "published" ? "Unpublish" : "Verify & publish"}
            </button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="auth-message">
          {message}
        </p>
      )}
      <nav className="admin-tabs" aria-label="Course editor sections">
        <button
          aria-current={tab === "details" ? "page" : undefined}
          onClick={() => setTab("details")}
        >
          Course details
        </button>
        <button
          aria-current={tab === "curriculum" ? "page" : undefined}
          disabled={!course}
          onClick={() => setTab("curriculum")}
        >
          Curriculum
        </button>
      </nav>
      {tab === "details" ? (
        <form key={course?.version ?? 0} className="admin-form" onSubmit={save}>
          <div className="admin-form-grid">
            <label>
              Course title
              <input
                name="title"
                required
                minLength={3}
                maxLength={150}
                defaultValue={course?.title}
              />
            </label>
            <label>
              URL slug
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={120}
                defaultValue={course?.slug}
                placeholder="market-foundations"
              />
            </label>
            <label>
              Level
              <select name="level" defaultValue={course?.level ?? "beginner"}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <label>
              Language
              <input
                name="language"
                required
                maxLength={30}
                defaultValue={course?.language ?? "Hindi"}
              />
            </label>
            <label>
              Base price (INR)
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                max="1000000"
                required
                defaultValue={(course?.price_paise ?? 0) / 100}
              />
            </label>
            <label>
              Sale price (optional, INR)
              <input
                name="sale"
                type="number"
                min="0"
                step="0.01"
                defaultValue={
                  course?.sale_price_paise === null
                    ? ""
                    : course?.sale_price_paise === undefined
                      ? ""
                      : course.sale_price_paise / 100
                }
              />
            </label>
          </div>
          <label>
            Course description
            <textarea
              name="description"
              rows={4}
              maxLength={2000}
              defaultValue={course?.description}
            />
          </label>
          <label>
            Learning outcomes (one per line)
            <textarea name="outcomes" rows={4} defaultValue={course?.outcomes.join("\n")} />
          </label>
          <div className="admin-form-grid">
            <label>
              Who this is for
              <textarea name="audience" rows={3} maxLength={1000} defaultValue={course?.audience} />
            </label>
            <label>
              Prerequisites
              <textarea
                name="prerequisites"
                rows={3}
                maxLength={1000}
                defaultValue={course?.prerequisites}
              />
            </label>
            <label>
              Thumbnail HTTPS URL (optional)
              <input name="thumbnail" type="url" defaultValue={course?.thumbnail_url ?? ""} />
            </label>
            <label>
              Fallback artwork
              <select name="artwork" defaultValue={course?.artwork ?? "foundations"}>
                <option value="foundations">Foundations</option>
                <option value="structure">Structure</option>
                <option value="risk">Risk</option>
              </select>
            </label>
          </div>
          <p className="admin-help">
            Save these details before changing curriculum. Prices are stored in paise; tax settings
            affect future orders only.
          </p>
          <button className="button button-primary" disabled={pending}>
            Save course details
          </button>
        </form>
      ) : (
        course && (
          <div className="admin-curriculum">
            <p className="admin-help">
              Drag module or lesson rows to reorder, or use the arrow buttons. Save a lesson before
              publishing its course.
            </p>
            {modules.map((m, index) => (
              <article
                className="admin-module"
                key={m.id}
                draggable={!pending}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", `module:${m.id}`)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const [type, id] = e.dataTransfer.getData("text/plain").split(":");
                  if (type === "module")
                    void reorder(
                      "modules",
                      modules.map((x) => x.id),
                      modules.findIndex((x) => x.id === id),
                      index,
                    );
                }}
              >
                <div className="admin-module-head">
                  <form
                    className="admin-inline-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      await run("module_save", {
                        courseId: course.id,
                        version: course.version,
                        id: m.id,
                        title: formText(f, "title"),
                      });
                    }}
                  >
                    <label>
                      <span className="sr-only">Module title</span>
                      <input
                        name="title"
                        required
                        minLength={2}
                        maxLength={150}
                        defaultValue={m.title}
                        key={m.title}
                      />
                    </label>
                    <button className="button button-secondary" disabled={pending}>
                      Save module
                    </button>
                  </form>
                  <div className="admin-actions">
                    <button
                      className="icon-button"
                      disabled={pending || index === 0}
                      aria-label={`Move module ${m.title} up`}
                      onClick={() =>
                        reorder(
                          "modules",
                          modules.map((x) => x.id),
                          index,
                          index - 1,
                        )
                      }
                    >
                      <ArrowUp size={17} />
                    </button>
                    <button
                      className="icon-button"
                      disabled={pending || index === modules.length - 1}
                      aria-label={`Move module ${m.title} down`}
                      onClick={() =>
                        reorder(
                          "modules",
                          modules.map((x) => x.id),
                          index,
                          index + 1,
                        )
                      }
                    >
                      <ArrowDown size={17} />
                    </button>
                  </div>
                </div>
                <LessonList
                  module={m}
                  course={course}
                  pending={pending}
                  run={run}
                  reorder={reorder}
                />
              </article>
            ))}
            <form
              className="admin-inline-form admin-panel"
              onSubmit={async (e) => {
                e.preventDefault();
                const form=e.currentTarget;
                const f = new FormData(form);
                if (
                  await run("module_save", {
                    courseId: course.id,
                    version: course.version,
                    title: formText(f, "title"),
                  })
                )
                  form.reset();
              }}
            >
              <label>
                New module title
                <input name="title" required minLength={2} maxLength={150} />
              </label>
              <button className="button button-primary" disabled={pending}>
                <Plus size={16} /> Add module
              </button>
            </form>
          </div>
        )
      )}
    </section>
  );
}
type Run = (action: string, data: unknown) => Promise<boolean>;
function LessonList({
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
function LessonEditor({
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
    <details className="admin-lesson-editor">
      <summary>{lesson ? `Edit lesson: ${lesson.title}` : "Add a lesson"}</summary>
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
            <UploadSimple size={16} /> Upload video
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
          cannot be replaced; add a new lesson instead. Unpublish a course before removing its final published lesson.
        </p>
        <button className="button button-primary" disabled={pending || busy}>
          Save lesson
        </button>
      </form>
    </details>
  );
}
