"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  UploadSimple,
  LinkSimple,
  Trash,
  CalendarBlank,
  Clock,
  CurrencyInr,
  Users,
  PencilSimple,
  Eye,
  FileText,
  ListBullets,
  Info,
} from "@phosphor-icons/react";
import { adminApi, operation, formText, formNumber, money } from "../../lib/admin-api";
import type { AdminCourse, AdminLesson, AdminModule } from "../../../shared/admin";
import { CourseLearnersPanel } from "./course-learners-panel";
import { CourseArtwork } from "../course-artwork";
import { CoursesSkeleton } from "./admin-skeletons";

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
  | "thumbnail_url"
  | "artwork"
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
  const [confirmingDelete, setConfirmingDelete] = useState<Summary | null>(null);
  async function list() {
    setLoading(true);
    setError("");
    try {
      const d = await adminApi<{ items: Summary[] }>("courses");
      setItems(d.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load courses.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    adminApi<{ items: Summary[] }>("courses")
      .then((d) => {
        if (!cancelled) setItems(d.items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load courses.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
  async function executeDelete(c: Summary) {
    setDeletingId(c.id);
    setError("");
    try {
      await operation("course_delete", {
        courseId: c.id,
        version: c.version,
      });
      setConfirmingDelete(null);
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
          {loading ? (
            <CoursesSkeleton />
          ) : error ? (
            <div
              className="admin-error-box"
              role="alert"
              style={{
                padding: "20px",
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "8px",
                margin: "16px 0",
              }}
            >
              <p style={{ color: "var(--error, #ef4444)", margin: "0 0 12px", fontWeight: 500 }}>
                {error}
              </p>
              <button
                type="button"
                className="button button-secondary button-sm"
                onClick={() => void list()}
              >
                Retry loading courses
              </button>
            </div>
          ) : items.length ? (
            <div className="admin-course-horizontal-list">
              {items.map((c) => {
                const formattedDate =
                  c.created_at || c.updated_at
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
                    <div className="admin-course-card-main-with-thumb">
                      <button
                        type="button"
                        className="admin-course-thumb-wrap"
                        onClick={() => open(c.id)}
                        aria-label={`Edit ${c.title}`}
                        style={{
                          cursor: "pointer",
                          border: "none",
                          background: "none",
                          padding: 0,
                          textAlign: "left",
                          display: "block",
                        }}
                      >
                        {(() => {
                          const thumb = (
                            c.thumbnail_url ||
                            (c as unknown as { thumbnailUrl?: string | null }).thumbnailUrl
                          )?.trim();
                          if (thumb) {
                            return (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={thumb}
                                alt={c.title}
                                className="admin-course-thumb-img"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  display: "block",
                                }}
                              />
                            );
                          }
                          return (
                            <CourseArtwork
                              kind={c.artwork || "foundations"}
                              className="admin-course-thumb-artwork"
                            />
                          );
                        })()}
                      </button>
                      <div className="admin-course-card-info">
                        <div className="admin-course-card-title-row">
                          <span className={`admin-badge status-${c.status}`}>{c.status}</span>
                          <button
                            type="button"
                            onClick={() => open(c.id)}
                            className="admin-course-card-title-link"
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              textAlign: "left",
                              cursor: "pointer",
                              font: "inherit",
                            }}
                          >
                            <strong className="admin-course-card-title">{c.title}</strong>
                          </button>
                        </div>
                        <span className="admin-course-card-slug">/{c.slug}</span>
                      </div>
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
                        onClick={() => setConfirmingDelete(c)}
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
          {confirmingDelete && (
            <div
              className="admin-modal-backdrop"
              onClick={() => !deletingId && setConfirmingDelete(null)}
            >
              <div
                className="admin-modal-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-dialog-title"
                aria-describedby="delete-dialog-desc"
                onClick={(e) => e.stopPropagation()}
              >
                <h3
                  id="delete-dialog-title"
                  style={{ margin: "0 0 12px", color: "var(--danger, #ef4444)" }}
                >
                  Delete course: {confirmingDelete.title}
                </h3>
                <p
                  id="delete-dialog-desc"
                  style={{
                    fontSize: "14px",
                    lineHeight: "1.6",
                    color: "var(--muted)",
                    margin: "0 0 20px",
                  }}
                >
                  Are you sure you want to permanently delete this course? This action is permanent
                  and cannot be undone. Active enrolled learners will immediately lose access to the
                  curriculum.
                </p>
                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={Boolean(deletingId)}
                    onClick={() => setConfirmingDelete(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button button-danger"
                    disabled={Boolean(deletingId)}
                    onClick={() => void executeDelete(confirmingDelete)}
                  >
                    {deletingId ? "Deleting course…" : "Permanently delete course"}
                  </button>
                </div>
              </div>
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
  const [thumbnailUrl, setThumbnailUrl] = useState(course?.thumbnail_url ?? "");
  const [thumbnailError, setThumbnailError] = useState(false);
  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [price, setPrice] = useState<number>((course?.price_paise ?? 0) / 100);
  const [accessPeriod, setAccessPeriod] = useState<number>(course?.access_period ?? 1);
  const [accessUnit, setAccessUnit] = useState<string>(course?.access_unit ?? "months");
  const [artwork, setArtwork] = useState<string>(course?.artwork ?? "foundations");
  const [outcomes, setOutcomes] = useState<string[]>(
    course?.outcomes && course.outcomes.length > 0
      ? course.outcomes
      : ["Understand market structure", "Read basic candlestick patterns"],
  );

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
      title: formText(f, "title") || title,
      slug: formText(f, "slug"),
      description: formText(f, "description") || description,
      price_paise: Math.round((formNumber(f, "price") || price) * 100),
      sale_price_paise: formText(f, "sale") ? Math.round(formNumber(f, "sale") * 100) : null,
      access_period: formNumber(f, "access_period") || accessPeriod,
      access_unit: formText(f, "access_unit") || accessUnit,
      level: formText(f, "level") || "beginner",
      language: formText(f, "language") || "Hindi",
      thumbnail_url: thumbnailUrl.trim(),
      outcomes: outcomes.map((v) => v.trim()).filter(Boolean),
      audience: formText(f, "audience"),
      prerequisites: formText(f, "prerequisites"),
      artwork: artwork || formText(f, "artwork") || "foundations",
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
      <nav className="admin-editor-breadcrumb" aria-label="Breadcrumb">
        <button type="button" className="admin-breadcrumb-btn" onClick={onBack}>
          Workspace
        </button>
        <span className="admin-breadcrumb-sep">&gt;</span>
        <button type="button" className="admin-breadcrumb-btn" onClick={onBack}>
          Courses
        </button>
        <span className="admin-breadcrumb-sep">&gt;</span>
        <span className="admin-breadcrumb-current">{course ? "Edit course" : "New course"}</span>
      </nav>

      <div className="admin-editor-heading">
        <div className="admin-editor-title-wrap">
          <h2>{course ? "Edit course" : "New course"}</h2>
          <p>Shape your course information and learner experience.</p>
        </div>
        {course && (
          <div className="admin-header-actions">
            <Link className="admin-preview-outline-btn" href={`/learn/${course.slug}`}>
              <Eye size={17} />
              <span>Preview course outline</span>
            </Link>
            <button
              type="button"
              className={`button ${course.status === "published" ? "button-secondary" : "button-primary"} admin-publish-header-btn`}
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
                  : "Publish"}
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
          type="button"
          aria-current={tab === "details" ? "page" : undefined}
          className={tab === "details" ? "is-active" : ""}
          onClick={() => setTab("details")}
        >
          <FileText size={18} /> Course details
        </button>
        <button
          type="button"
          aria-current={tab === "curriculum" ? "page" : undefined}
          className={tab === "curriculum" ? "is-active" : ""}
          disabled={!course}
          onClick={() => setTab("curriculum")}
        >
          <ListBullets size={18} /> Curriculum
        </button>
      </nav>

      {tab === "details" && (
        <div className="admin-editor-grid">
          <div className="admin-editor-left">
            <form
              id="course-details-form"
              className="admin-form"
              key={course?.version ?? 0}
              onSubmit={save}
            >
              {/* Card 1: Course information */}
              <div className="admin-editor-card">
                <div className="admin-section-header">
                  <span className="admin-step-number">1</span>
                  <div className="admin-section-title-wrap">
                    <h3>Course information</h3>
                    <p>Basic details about your course and learning outcomes.</p>
                  </div>
                </div>

                <label>
                  Course title
                  <input
                    name="title"
                    required
                    minLength={3}
                    maxLength={150}
                    value={title}
                    placeholder="e.g. Market Foundations"
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>

                <label>
                  Course description
                  <textarea
                    name="description"
                    rows={3}
                    maxLength={2000}
                    value={description}
                    placeholder="Learn the foundations of financial markets, price movement and confident trading."
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>

                <div className="admin-outcomes-field">
                  <span className="admin-field-label">Learning outcomes (one per line)</span>
                  <div className="admin-outcomes-list">
                    {outcomes.map((outcome, idx) => (
                      <div key={idx} className="admin-outcome-row">
                        <input
                          type="text"
                          value={outcome}
                          placeholder="e.g. Understand market structure"
                          onChange={(e) => {
                            const updated = [...outcomes];
                            updated[idx] = e.target.value;
                            setOutcomes(updated);
                          }}
                        />
                        {outcomes.length > 1 && (
                          <button
                            type="button"
                            className="admin-outcome-trash-btn"
                            title="Remove outcome"
                            onClick={() => setOutcomes(outcomes.filter((_, i) => i !== idx))}
                          >
                            <Trash size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="admin-add-outcome-btn"
                    onClick={() => setOutcomes([...outcomes, ""])}
                  >
                    <Plus size={15} /> Add outcome
                  </button>
                </div>

                <div className="admin-form-grid">
                  <label>
                    Who this is for
                    <input
                      name="audience"
                      maxLength={1000}
                      defaultValue={course?.audience}
                      placeholder="Beginner traders"
                    />
                  </label>
                  <label>
                    Prerequisites
                    <input
                      name="prerequisites"
                      maxLength={1000}
                      defaultValue={course?.prerequisites}
                      placeholder="No prior experience required"
                    />
                  </label>
                </div>

                <div className="admin-form-grid">
                  <label>
                    URL slug
                    <input
                      name="slug"
                      required
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      maxLength={120}
                      defaultValue={
                        course?.slug ??
                        (title
                          ? title
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, "-")
                              .replace(/^-|-$/g, "")
                          : "")
                      }
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
                </div>
              </div>

              {/* Card 2: Pricing & access */}
              <div className="admin-editor-card">
                <div className="admin-section-header">
                  <span className="admin-step-number">2</span>
                  <div className="admin-section-title-wrap">
                    <h3>Pricing &amp; access</h3>
                    <p>Set the price and access period for this course.</p>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <label>
                    Price (INR)
                    <div className="admin-price-input-row">
                      <span className="admin-price-prefix">₹</span>
                      <input
                        name="price"
                        type="number"
                        min="0"
                        step="0.01"
                        max="1000000"
                        required
                        value={price || ""}
                        onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                        placeholder="198.99"
                      />
                      <span className="admin-price-badge">One-time payment</span>
                    </div>
                  </label>

                  <label>
                    Access period
                    <div className="admin-access-row">
                      <input
                        name="access_period"
                        type="number"
                        min="1"
                        max="3650"
                        step="1"
                        required
                        value={accessPeriod}
                        onChange={(e) => setAccessPeriod(parseInt(e.target.value, 10) || 1)}
                      />
                      <select
                        name="access_unit"
                        value={accessUnit}
                        onChange={(e) => setAccessUnit(e.target.value)}
                      >
                        <option value="months">Calendar month</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                  </label>
                </div>

                <div className="admin-form-grid" style={{ marginTop: "10px" }}>
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
                      placeholder="Optional discounted price"
                    />
                  </label>
                </div>

                <p className="admin-help-subtle">
                  Access begins after successful payment. Changes apply to future purchases only.
                </p>
              </div>

              {/* Card 3: Course artwork */}
              <div className="admin-editor-card">
                <div className="admin-section-header">
                  <span className="admin-step-number">3</span>
                  <div className="admin-section-title-wrap">
                    <h3>
                      Course artwork
                      <span className="admin-section-subtitle-inline">
                        Add a thumbnail image for your course.
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <label>
                    Thumbnail HTTPS URL (optional)
                    <input
                      name="thumbnail"
                      type="url"
                      value={thumbnailUrl}
                      onChange={(e) => {
                        setThumbnailUrl(e.target.value);
                        setThumbnailError(false);
                      }}
                      placeholder="https://"
                    />
                  </label>
                  <label>
                    Fallback artwork
                    <select
                      name="artwork"
                      value={artwork}
                      onChange={(e) => setArtwork(e.target.value)}
                    >
                      <option value="foundations">Foundations</option>
                      <option value="structure">Structure</option>
                      <option value="risk">Risk</option>
                    </select>
                  </label>
                </div>
                <p className="admin-help-subtle">Used when no thumbnail is provided.</p>
              </div>

              {course && (
                <div className="admin-editor-card admin-editor-danger-zone">
                  <div className="admin-section-header">
                    <div className="admin-section-title-wrap">
                      <h3 style={{ color: "#ef4444" }}>Course actions</h3>
                      <p>
                        Archive this course from the storefront or permanently delete this draft.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "4px" }}>
                    {course.status !== "archived" && (
                      <button
                        type="button"
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
                    <button
                      type="button"
                      className="button button-danger"
                      disabled={pending}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            "Permanently delete this draft course and its curriculum?",
                          )
                        )
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
                      <Trash size={16} /> Delete course
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          <aside className="admin-course-preview" aria-label="Course preview">
            <div className="admin-preview-title">
              <Info size={20} className="admin-preview-icon" />
              <div>
                <strong>Course preview</strong>
                <small>This is how your course will appear to learners.</small>
              </div>
            </div>

            {thumbnailUrl.trim() && !thumbnailError ? (
              <div className="admin-course-preview-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnailUrl.trim()}
                  alt={title || "Course thumbnail"}
                  className="admin-course-preview-img"
                  onError={() => setThumbnailError(true)}
                />
              </div>
            ) : (
              <div className={`admin-course-artwork artwork-${artwork}`}>
                <span>
                  {(title || "NEW COURSE").split(" ").slice(0, 2).join(" ").toUpperCase()}
                </span>
              </div>
            )}

            <span className="admin-preview-label">Course title</span>
            <h3>{title || "Course title"}</h3>
            <p>
              {description ||
                "Learn the foundations of financial markets, price movement and confident trading."}
            </p>
            <div className="admin-preview-price">₹{price ? price.toFixed(2) : "0.00"}</div>
            <div className="admin-preview-access">
              <Clock size={16} /> {accessPeriod}{" "}
              {accessUnit === "days"
                ? accessPeriod === 1
                  ? "day"
                  : "days"
                : accessPeriod === 1
                  ? "month"
                  : "months"}{" "}
              access
            </div>

            <div className="admin-editor-tip-card">
              <Info size={18} weight="fill" className="admin-tip-icon" />
              <div className="admin-tip-content">
                <strong>Before you continue</strong>
                <p>Save your details before editing the curriculum.</p>
              </div>
            </div>
          </aside>
        </div>
      )}

      {tab === "curriculum" && course && (
        <div className="admin-curriculum-wrap">
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
        </div>
      )}

      <div className="admin-editor-footer">
        <div className="admin-footer-status">
          <span className="admin-footer-dot" />
          <div>
            <strong>Unsaved changes</strong>
            <small>You have unpublished changes on this course.</small>
          </div>
        </div>
        <div className="admin-footer-actions">
          <button type="button" className="button button-secondary" onClick={onBack}>
            Cancel
          </button>
          <button
            type="submit"
            form="course-details-form"
            className="button button-primary"
            disabled={pending}
          >
            Save changes
          </button>
        </div>
      </div>
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
