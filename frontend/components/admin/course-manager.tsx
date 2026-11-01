"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  UploadSimple,
  Trash,
  CalendarBlank,
  Clock,
  CurrencyInr,
  Users,
  PencilSimple,
} from "@phosphor-icons/react";
import { adminApi, operation, formText, formNumber, money } from "../../lib/admin-api";
import type { AdminCourse, AdminLesson, AdminModule } from "../../../shared/admin";
import { CourseLearnersPanel } from "./course-learners-panel";

type Summary = Pick<
  AdminCourse,
  | "id"
  | "title"
  | "slug"
  | "status"
  | "price_paise"
  | "sale_price_paise"
  | "access_period"
  | "access_unit"
  | "version"
  | "updated_at"
  | "created_at"
>;
export function CourseManager() {
  const [items, setItems] = useState<Summary[]>([]);
  const [course, setCourse] = useState<AdminCourse | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [learnersCourseId, setLearnersCourseId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
  async function deleteCourse(c: Summary) {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete "${c.title}"? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingId(c.id);
    setError("");
    try {
      await operation("course_delete", {
        courseId: c.id,
        version: c.version,
      });
      await list();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete course.");
    } finally {
      setDeletingId(null);
    }
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
      {learnersCourseId && (
        <CourseLearnersPanel
          courseId={learnersCourseId}
          onBack={() => setLearnersCourseId(null)}
          onEdit={() => {
            void open(learnersCourseId);
            setLearnersCourseId(null);
          }}
        />
      )}
      {!learnersCourseId && (
      <>
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
        <div className="admin-course-horizontal-list">
          {items.map((c) => {
            const formattedDate = c.created_at || c.updated_at
              ? new Date(c.created_at || c.updated_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—";
            const validity = `${c.access_period || 1} ${c.access_unit || "months"}`;
            const isDeleting = deletingId === c.id;

            return (
              <article className="admin-course-horizontal-card" key={c.id}>
                <div className="admin-course-card-main">
                  <div className="admin-course-card-title-row">
                    <span className={`admin-badge status-${c.status}`}>{c.status}</span>
                    <strong className="admin-course-card-title">{c.title}</strong>
                  </div>
                  <span className="admin-course-card-slug">/{c.slug}</span>
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
                    {c.sale_price_paise && c.sale_price_paise < c.price_paise ? (
                      <>
                        <span className="price-sale">{money(c.sale_price_paise)}</span>
                        <s className="price-original">{money(c.price_paise)}</s>
                      </>
                    ) : (
                      <span>{money(c.price_paise)}</span>
                    )}
                  </div>
                </div>

                <div className="admin-course-card-actions">
                  <button
                    type="button"
                    className="button button-secondary button-sm"
                    onClick={() => setLearnersCourseId(c.id)}
                    title="View learners"
                  >
                    <Users size={15} />
                    <span>Learners</span>
                  </button>
                  <button
                    type="button"
                    className="button button-secondary button-sm"
                    onClick={() => open(c.id)}
                    title="Edit curriculum"
                  >
                    <PencilSimple size={15} />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    className="button button-danger button-sm"
                    disabled={isDeleting}
                    onClick={() => void deleteCourse(c)}
                    title="Delete course"
                  >
                    <Trash size={15} />
                    <span>{isDeleting ? "Deleting…" : "Delete"}</span>
                  </button>
                </div>
              </article>
            );
          })}
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
      </>
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
      const id = course?.id ?? d.courseId ?? d.id;
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
      access_period: formNumber(f, "access_period"),
      access_unit: formText(f, "access_unit"),
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
      <div className="admin-editor-breadcrumb"><button className="text-link" onClick={onBack}>Workspace</button><span>›</span><button className="text-link" onClick={onBack}>Courses</button><span>›</span><strong>Edit course</strong></div>
      <div className="admin-section-head admin-editor-heading">
        <div>
          <h2>{course ? "Edit course" : "New course"}</h2>
          <p>Shape your course information and learner experience.</p>
        </div>
        {course && <Link className="button button-secondary" href={`/learn/${course.slug}`}>Preview course outline</Link>}
        {course && (
          <div className="admin-actions">
            <Link className="button button-secondary" href={`/learn/${course.slug}`}>
              View classroom
            </Link>
            {course.status !== "archived" && (
              <button
                className="button button-secondary"
                disabled={pending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Archive this course? It will leave the storefront, while existing orders and learner records are preserved.",
                    )
                  )
                    void run("course_state", {
                      courseId: course.id,
                      version: course.version,
                      status: "archived",
                    });
                }}
              >
                Archive course
              </button>
            )}
            {course && (
              <button
                className="button button-secondary"
                disabled={pending}
                onClick={async () => {
                  if (!window.confirm("Permanently delete this draft course and its curriculum?"))
                    return;
                  setPending(true);
                  setError("");
                  try {
                    await operation("course_delete", {
                      courseId: course.id,
                      version: course.version,
                    });
                    onBack();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Course could not be deleted.");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Delete course
              </button>
            )}
            <button
              className="button button-primary"
              disabled={pending}
              onClick={() =>
                run("course_state", {
                  courseId: course.id,
                  version: course.version,
                  status:
                    course.status === "published"
                      ? "draft"
                      : course.status === "archived"
                        ? "draft"
                        : "published",
                })
              }
            >
              {course.status === "published"
                ? "Unpublish"
                : course.status === "archived"
                  ? "Restore as draft"
                  : "Verify & publish"}
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
      <div className="admin-editor-grid">
        <div className="admin-editor-left">
      {tab === "details" ? (
        <form id="course-details-form" key={course?.version ?? 0} className="admin-form" onSubmit={save}>
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
          <div className="admin-form-grid">
            <label>
              Access period
              <input
                name="access_period"
                type="number"
                min="1"
                max="3650"
                step="1"
                required
                defaultValue={course?.access_period ?? 1}
              />
            </label>
            <label>
              Access period unit
              <select name="access_unit" defaultValue={course?.access_unit ?? "months"}>
                <option value="months">Calendar months</option>
                <option value="days">Days</option>
              </select>
            </label>
          </div>
          <p className="admin-help">
            Access starts when payment succeeds. Changing this period affects future orders;
            existing expiry dates stay unchanged. No lifetime access or automatic recurring charges.
          </p>
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
                const form = e.currentTarget;
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
        </div>
        {course && (
          <aside className="admin-course-preview" aria-label="Course preview">
            <div className="admin-preview-title"><span>ⓘ</span><div><strong>Course preview</strong><small>This is how your course will appear to learners.</small></div></div>
            <div className={`admin-course-artwork artwork-${course.artwork ?? "foundations"}`}><span>{course.title.split(" ").slice(0, 2).join(" ").toUpperCase()}</span></div>
            <span className="admin-preview-label">Course title</span><h3>{course.title}</h3>
            <p>{course.description || "Add a course description to help learners understand what they will learn."}</p>
            <div className="admin-preview-price">{money(course.sale_price_paise ?? course.price_paise)}</div>
            <div className="admin-preview-access"><Clock size={17} /> {course.access_period || 1} {course.access_unit || "months"} access</div>
          </aside>
        )}
      </div>
      <div className="admin-editor-footer"><span><i /> Unsaved changes<small>You have unpublished changes on this course.</small></span><div><button type="button" className="button button-secondary" onClick={onBack}>Cancel</button><button type="submit" form="course-details-form" className="button button-primary" disabled={pending}>Save changes</button></div></div>
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
