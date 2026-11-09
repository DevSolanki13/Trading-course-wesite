"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, MagnifyingGlass } from "@phosphor-icons/react";
import { adminApi, when } from "../../lib/admin-api";
import type { AdminLearnerDetail, AdminLearnerPage } from "../../../shared/admin-learners";
import { TableSkeleton, AdminSectionHeadSkeleton } from "./admin-skeletons";

function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} min` : `${Math.round(seconds)} sec`;
}

export function CourseLearnersPanel({
  courseId,
  onBack,
  onEdit,
}: {
  courseId: string;
  onBack: () => void;
  onEdit: () => void;
}) {
  return <CourseLearners key={courseId} courseId={courseId} onBack={onBack} onEdit={onEdit} />;
}

function CourseLearners({
  courseId,
  onBack,
  onEdit,
}: {
  courseId: string;
  onBack: () => void;
  onEdit: () => void;
}) {
  const [loaded, setLoaded] = useState<{ path: string; data: AdminLearnerPage } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ id: string; data: AdminLearnerDetail } | null>(null);
  const [query, setQuery] = useState("");
  const [access, setAccess] = useState("all");
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [detailRetry, setDetailRetry] = useState(0);
  const [failure, setFailure] = useState<{ path: string; message: string } | null>(null);
  const path = `course-learners?${new URLSearchParams({ courseId, q: query, access, page: String(page) })}`;
  const detailPath = selectedId
    ? `course-learners?${new URLSearchParams({ courseId, learnerId: selectedId })}`
    : null;
  const error = failure?.path === (detailPath ?? path) ? failure.message : "";
  const data = loaded?.data ?? null;
  const loading = loaded?.path !== path;
  useEffect(() => {
    let live = true;
    const timer = setTimeout(
      () =>
        void adminApi<AdminLearnerPage>(path)
          .then((result) => {
            if (live) {
              setLoaded({ path, data: result });
              setFailure((current) => (current?.path === path ? null : current));
            }
          })
          .catch((e) => {
            if (live)
              setFailure({
                path,
                message: e instanceof Error ? e.message : "Learners could not load.",
              });
          }),
      200,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [path, retry]);
  useEffect(() => {
    if (!detailPath || !selectedId) return;
    let live = true;
    adminApi<AdminLearnerDetail>(detailPath)
      .then((result) => {
        if (live) {
          setDetail({ id: selectedId, data: result });
          setFailure((current) => (current?.path === detailPath ? null : current));
        }
      })
      .catch((e) => {
        if (live)
          setFailure({
            path: detailPath,
            message: e instanceof Error ? e.message : "Lesson details could not load.",
          });
      });
    return () => {
      live = false;
    };
  }, [detailPath, selectedId, detailRetry]);
  const learners = loading ? [] : (data?.learners ?? []);
  const selected = detail?.id === selectedId ? detail.data.learner : null;
  if (error && !data)
    return (
      <section>
        <button className="text-link" onClick={onBack}>
          <ArrowLeft size={16} /> All courses
        </button>
        <p className="auth-error" role="alert">
          {error}
        </p>
        <button
          className="button button-secondary"
          onClick={() => {
            setFailure(null);
            setRetry((value) => value + 1);
          }}
        >
          Try again
        </button>
      </section>
    );
  if (!data)
    return (
      <section aria-label="Loading enrolled learners" role="status">
        <AdminSectionHeadSkeleton titleWidth={200} descWidth={320} />
        <TableSkeleton columns={["30%", "26%", "16%", "12%", "16%"]} rows={5} />
      </section>
    );
  return (
    <section>
      <button className="text-link" onClick={onBack}>
        <ArrowLeft size={16} /> All courses
      </button>
      <div className="admin-section-head">
        <div>
          <span className="auth-section-label">Course learners</span>
          <h2>{data.course.title}</h2>
          <p>
            {data.enrolledTotal} enrolled · {data.course.lessonCount} published lessons
          </p>
        </div>
        <div className="admin-actions">
          <button className="button button-secondary" onClick={onEdit}>
            Edit course
          </button>
          <label className="admin-search">
            <MagnifyingGlass size={17} />
            <span className="sr-only">Search learners</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
                setSelectedId(null);
              }}
              placeholder="Search learners"
            />
          </label>
          <label>
            <span className="sr-only">Filter learner access</span>
            <select
              aria-label="Filter learner access"
              value={access}
              onChange={(event) => {
                setAccess(event.target.value);
                setPage(0);
                setSelectedId(null);
              }}
            >
              <option value="all">All access</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </label>
        </div>
      </div>
      {error && (
        <p className="auth-error" role="alert">
          {error}
          <button
            className="text-link"
            onClick={() => {
              setFailure(null);
              if (selectedId) setDetailRetry((value) => value + 1);
              else setRetry((value) => value + 1);
            }}
          >
            Try again
          </button>
        </p>
      )}
      {selectedId && !selected ? (
        <section className="admin-panel">
          <button className="text-link" onClick={() => setSelectedId(null)}>
            <ArrowLeft size={16} /> All learners
          </button>
          {!error && <p role="status">Loading lesson details…</p>}
        </section>
      ) : selected ? (
        <section className="admin-panel">
          <button className="text-link" onClick={() => setSelectedId(null)}>
            <ArrowLeft size={16} /> All learners
          </button>
          <div className="admin-section-head">
            <div>
              <h3>{selected.name || "Unnamed learner"}</h3>
              <p>{selected.email}</p>
            </div>
            <strong>{selected.progressPercent}% complete</strong>
          </div>
          <div className="admin-progress" aria-label={`${selected.progressPercent}% complete`}>
            <span style={{ width: `${selected.progressPercent}%` }} />
          </div>
          <p className="admin-muted">
            {selected.completedLessons}/{selected.totalLessons} lessons ·{" "}
            {duration(selected.watchedSeconds)} watched · Last activity{" "}
            {when(selected.lastActiveAt)}
          </p>
          <div className="admin-table-wrap">
            <table>
              <caption className="sr-only">Lesson progress for {selected.name}</caption>
              <colgroup>
                <col style={{ width: "42%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "18%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Lesson</th>
                  <th>Progress</th>
                  <th>Watched</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {selected.lessons.map((lesson) => (
                  <tr key={lesson.lessonId}>
                    <td>
                      <strong>{lesson.title}</strong>
                      <small>{lesson.moduleTitle}</small>
                    </td>
                    <td>{lesson.completed ? "Completed" : duration(lesson.positionSeconds)}</td>
                    <td>{duration(lesson.watchedSeconds)}</td>
                    <td>{when(lesson.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="admin-table-wrap" aria-busy={loading}>
          <table>
            <caption className="sr-only">Enrolled learners for {data.course.title}</caption>
            <colgroup>
              <col style={{ width: "30%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Progress</th>
                <th>Watched</th>
                <th>Access</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((learner) => (
                <tr key={learner.enrollmentId}>
                  <td>
                    <button
                      className="text-link"
                      onClick={() => {
                        setDetail(null);
                        setSelectedId(learner.id);
                      }}
                    >
                      {learner.name || learner.email}
                    </button>
                    <small>{learner.email}</small>
                  </td>
                  <td>
                    <div className="admin-progress">
                      <span style={{ width: `${learner.progressPercent}%` }} />
                    </div>
                    <small>
                      {learner.completedLessons}/{learner.totalLessons} · {learner.progressPercent}%
                    </small>
                  </td>
                  <td>{duration(learner.watchedSeconds)}</td>
                  <td>
                    <span className="admin-badge">{learner.active ? "Active" : "Expired"}</span>
                  </td>
                  <td>{when(learner.lastActiveAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && !error && <p role="status">Loading learners…</p>}
          {!loading && !learners.length && (
            <div className="admin-empty">
              <h3>No matching learners.</h3>
              <p>Try a different name or email.</p>
            </div>
          )}
          <nav className="admin-actions" aria-label="Learner pages">
            <button
              className="button button-secondary"
              disabled={loading || page === 0}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <span aria-live="polite">
              Page {page + 1}
              {!loading && ` · ${data.total} matching learners`}
            </span>
            <button
              className="button button-secondary"
              disabled={loading || (page + 1) * data.pageSize >= data.total || page >= 10000}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </section>
  );
}
