"use client";
import { useEffect, useState } from "react";
import {
  CalendarBlank,
  Clock,
  CurrencyInr,
  PencilSimple,
  Plus,
  Trash,
  Users,
} from "@phosphor-icons/react";
import { adminApi, operation, money } from "../../lib/admin-api";
import type { AdminCourse } from "../../../shared/admin";
import { CourseLearnersPanel } from "./course-learners-panel";
import { CourseArtwork } from "../course-artwork";
import { CoursesSkeleton } from "./admin-skeletons";
import { CourseEditor } from "./course-editor";

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
