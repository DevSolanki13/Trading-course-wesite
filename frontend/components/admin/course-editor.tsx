"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Eye,
  FileText,
  Info,
  ListBullets,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { formNumber, formText, operation } from "../../lib/admin-api";
import type { AdminCourse } from "../../../shared/admin";
import { LessonList } from "./lesson-editor";

export function CourseEditor({
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

