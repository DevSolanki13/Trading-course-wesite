"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarBlank,
  CaretDown,
  Check,
  LockSimple,
  Play,
  PlayCircle,
} from "@phosphor-icons/react";
import { CourseArtwork } from "../course-artwork";
import { accessExpiryLabel } from "../../../shared/course-access";
import type { PurchaseCourse, PurchaseLessonContent } from "../../../shared/purchase";

export interface CurriculumSidebarProps {
  course: PurchaseCourse;
  lesson: PurchaseLessonContent;
  onBack?: () => void;
  onLessonChange?: (lessonId: string) => void;
  completedLessonsCount: number;
  totalLessons: number;
}

export function CurriculumSidebar({
  course,
  lesson,
  onBack,
  onLessonChange,
  completedLessonsCount,
  totalLessons,
}: CurriculumSidebarProps) {
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

  return (
    <aside className="vlp-sidebar" aria-label="Course curriculum">
      {/* Back link */}
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="vlp-back-link"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <ArrowLeft size={16} />
          <span>Back to my courses</span>
        </button>
      ) : (
        <Link href="/dashboard" className="vlp-back-link">
          <ArrowLeft size={16} />
          <span>Back to my courses</span>
        </Link>
      )}

      {/* Course card banner with candlestick/artwork */}
      <div className="vlp-course-card">
        {course.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={course.thumbnail} alt={course.title} className="vlp-course-card-bg" />
        ) : (
          <div className="vlp-course-card-artwork">
            <CourseArtwork
              kind={
                course.slug.includes("price")
                  ? "structure"
                  : course.slug.includes("risk")
                    ? "risk"
                    : "foundations"
              }
            />
          </div>
        )}
        <div className="vlp-course-card-gradient" />
        <h2 className="vlp-course-card-title">{course.title}</h2>
      </div>

      {/* Progress bar block */}
      <div className="vlp-progress-block">
        <div className="vlp-progress-labels">
          <span>{course.progress}% complete</span>
          <span>
            {completedLessonsCount} of {totalLessons} lessons
          </span>
        </div>
        <div className="vlp-progress-track">
          <div className="vlp-progress-bar" style={{ width: `${course.progress}%` }} />
        </div>
      </div>

      {/* Course content title */}
      <span className="vlp-content-label">Course content</span>

      {/* Modules and lessons tree */}
      <div className="vlp-curriculum-tree">
        {course.modules.map((module, mIdx) => {
          const isCollapsed = !!collapsedModules[module.id];
          return (
            <div className="vlp-module-accordion" key={module.id}>
              <button
                type="button"
                className="vlp-module-header"
                onClick={() =>
                  setCollapsedModules({
                    ...collapsedModules,
                    [module.id]: !isCollapsed,
                  })
                }
                aria-expanded={!isCollapsed}
              >
                <div className="vlp-module-title-box">
                  <strong>Module {mIdx + 1}</strong>
                  <span>{module.title}</span>
                </div>
                <CaretDown
                  size={15}
                  className={`vlp-module-chevron ${isCollapsed ? "" : "is-open"}`}
                />
              </button>

              {!isCollapsed && (
                <div className="vlp-lesson-list">
                  {module.lessons.map((item, lIdx) => {
                    const isActive = item.id === lesson.id;
                    const isCompleted = item.completed;
                    const isLocked = !course.owned && !item.preview;
                    const lessonNumber = (lIdx + 1).toString().padStart(2, "0");
                    const itemDurationMin = item.duration
                      ? Math.max(1, Math.round(item.duration / 60))
                      : 10 + (lIdx % 5) * 2;

                    if (isLocked) {
                      return (
                        <div
                          key={item.id}
                          className="vlp-lesson-item is-locked"
                          aria-disabled="true"
                          style={{ opacity: 0.65, cursor: "not-allowed" }}
                        >
                          <div className="vlp-lesson-icon is-locked" aria-label="Locked lesson">
                            <LockSimple size={13} />
                          </div>
                          <span className="vlp-lesson-name">
                            {lessonNumber} {item.title}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "color-mix(in srgb, var(--surface) 90%, #000)",
                              color: "var(--muted)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            Locked
                          </span>
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.id}
                        href={`/learn/${course.slug}/${item.id}`}
                        onClick={(e) => {
                          if (onLessonChange) {
                            e.preventDefault();
                            onLessonChange(item.id);
                          }
                        }}
                        className={`vlp-lesson-item ${isActive ? "is-active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <div
                          className={`vlp-lesson-icon ${
                            isActive ? "is-active" : isCompleted ? "is-completed" : "is-unwatched"
                          }`}
                        >
                          {isCompleted ? (
                            <Check size={14} weight="bold" />
                          ) : isActive ? (
                            <Play size={11} weight="fill" />
                          ) : (
                            <PlayCircle size={15} />
                          )}
                        </div>
                        <span className="vlp-lesson-name">
                          {lessonNumber} {item.title}
                        </span>
                        <span className="vlp-lesson-duration">{itemDurationMin} min</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Access Validity / Calendar pin at bottom */}
      <div className="vlp-sidebar-footer">
        <CalendarBlank size={15} />
        <span>
          {course.accessExpiresAt
            ? `Access until ${accessExpiryLabel(course.accessExpiresAt)}`
            : "Standard enrolled access"}
        </span>
      </div>
    </aside>
  );
}
