"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MagnifyingGlass } from "@phosphor-icons/react";
import { adminApi, when } from "../../lib/admin-api";
import type { AdminCourseLearners } from "../../../shared/admin";

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
  const [data, setData] = useState<AdminCourseLearners | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    return adminApi<AdminCourseLearners>(`course-learners?courseId=${encodeURIComponent(courseId)}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Learners could not load."));
  };
  useEffect(() => {
    let live = true;
    adminApi<AdminCourseLearners>(`course-learners?courseId=${encodeURIComponent(courseId)}`)
      .then((result) => {
        if (live) setData(result);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "Learners could not load.");
      });
    return () => {
      live = false;
    };
  }, [courseId]);
  const learners = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.learners ?? []).filter(
      (learner) => !needle || `${learner.name} ${learner.email}`.toLowerCase().includes(needle),
    );
  }, [data, query]);
  const selected = data?.learners.find((learner) => learner.id === selectedId) ?? null;
  if (error && !data)
    return (
      <section>
        <button className="text-link" onClick={onBack}>
          <ArrowLeft size={16} /> All courses
        </button>
        <p className="auth-error" role="alert">{error}</p>
        <button className="button button-secondary" onClick={() => void load()}>Try again</button>
      </section>
    );
  if (!data)
    return <p role="status">Loading enrolled learners…</p>;
  return (
    <section>
      <button className="text-link" onClick={onBack}>
        <ArrowLeft size={16} /> All courses
      </button>
      <div className="admin-section-head">
        <div>
          <span className="auth-section-label">Course learners</span>
          <h2>{data.course.title}</h2>
          <p>{data.learners.length} enrolled · {data.course.lessonCount} published lessons</p>
        </div>
        <div className="admin-actions">
          <button className="button button-secondary" onClick={onEdit}>
            Edit course
          </button>
          <label className="admin-search">
            <MagnifyingGlass size={17} />
            <span className="sr-only">Search learners</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search learners" />
          </label>
        </div>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {selected ? (
        <section className="admin-panel">
          <button className="text-link" onClick={() => setSelectedId(null)}>
            <ArrowLeft size={16} /> All learners
          </button>
          <div className="admin-section-head">
            <div><h3>{selected.name || "Unnamed learner"}</h3><p>{selected.email}</p></div>
            <strong>{selected.progressPercent}% complete</strong>
          </div>
          <div className="admin-progress" aria-label={`${selected.progressPercent}% complete`}>
            <span style={{ width: `${selected.progressPercent}%` }} />
          </div>
          <p className="admin-muted">
            {selected.completedLessons}/{selected.totalLessons} lessons · {duration(selected.watchedSeconds)} watched · Last activity {when(selected.lastActiveAt)}
          </p>
          <div className="admin-table-wrap">
            <table>
              <caption className="sr-only">Lesson progress for {selected.name}</caption>
              <thead><tr><th>Lesson</th><th>Progress</th><th>Watched</th><th>Updated</th></tr></thead>
              <tbody>{selected.lessons.map((lesson) => (
                <tr key={lesson.lessonId}>
                  <td><strong>{lesson.title}</strong><small>{lesson.moduleTitle}</small></td>
                  <td>{lesson.completed ? "Completed" : duration(lesson.positionSeconds)}</td>
                  <td>{duration(lesson.watchedSeconds)}</td>
                  <td>{when(lesson.updatedAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="admin-table-wrap">
          <table>
            <caption className="sr-only">Enrolled learners for {data.course.title}</caption>
            <thead><tr><th>Learner</th><th>Progress</th><th>Watched</th><th>Access</th><th>Last activity</th></tr></thead>
            <tbody>{learners.map((learner) => (
              <tr key={learner.id}>
                <td><button className="text-link" onClick={() => setSelectedId(learner.id)}>{learner.name || learner.email}</button><small>{learner.email}</small></td>
                <td><div className="admin-progress"><span style={{ width: `${learner.progressPercent}%` }} /></div><small>{learner.completedLessons}/{learner.totalLessons} · {learner.progressPercent}%</small></td>
                <td>{duration(learner.watchedSeconds)}</td>
                <td><span className="admin-badge">{learner.active ? "Active" : "Expired"}</span></td>
                <td>{when(learner.lastActiveAt)}</td>
              </tr>
            ))}</tbody>
          </table>
          {!learners.length && <div className="admin-empty"><h3>No matching learners.</h3><p>Try a different name or email.</p></div>}
        </div>
      )}
    </section>
  );
}
