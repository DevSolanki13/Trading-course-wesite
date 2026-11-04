"use client";

import Link from "next/link";
import { MagnifyingGlass, Check, CheckCircle, ArrowRight } from "@phosphor-icons/react";
import { CourseArtwork } from "../course-artwork";
import type { PurchaseCourse } from "../../../shared/purchase";

export interface StudentExplorePanelProps {
  exploreQuery: string;
  setExploreQuery: (q: string) => void;
  exploreLevel: string;
  setExploreLevel: (level: string) => void;
  availableLevels: string[];
  filteredExploreCourses: PurchaseCourse[];
  onSelectCoursesView: () => void;
  onOpenCourse: (slug: string, lessonId?: string | null) => void;
}

export function StudentExplorePanel({
  exploreQuery,
  setExploreQuery,
  exploreLevel,
  setExploreLevel,
  availableLevels,
  filteredExploreCourses,
  onSelectCoursesView,
  onOpenCourse,
}: StudentExplorePanelProps) {
  return (
    <div>
      <div className="student-greeting-head">
        <div>
          <h1>Explore courses</h1>
          <p>Discover structured trading programs, candlestick analysis, and risk management.</p>
        </div>
      </div>

      {/* Search & Level Filter Bar */}
      <div className="student-search-bar-row">
        <div className="student-search-input-wrap">
          <MagnifyingGlass size={18} className="student-search-icon" />
          <input
            type="text"
            value={exploreQuery}
            onChange={(e) => setExploreQuery(e.target.value)}
            placeholder="Search courses by topic, title or keywords…"
            aria-label="Search courses by topic, title or keywords"
          />
        </div>
        <select
          value={exploreLevel}
          onChange={(e) => setExploreLevel(e.target.value)}
          aria-label="Filter courses by difficulty level"
        >
          <option value="all">All levels</option>
          {availableLevels.map((lvl) => (
            <option key={lvl.toLowerCase()} value={lvl.toLowerCase()}>
              {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Courses Catalogue Grid */}
      {filteredExploreCourses.length ? (
        <div className="student-course-grid">
          {filteredExploreCourses.map((c) => {
            const isOwned = c.owned;
            const priceInRupees = Math.round(c.price / 100);

            return (
              <article className="student-explore-card" key={c.id}>
                <div className="student-explore-card-thumb">
                  {c.thumbnail ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={c.thumbnail} alt={c.title} />
                  ) : (
                    <CourseArtwork
                      kind={
                        c.slug.includes("price")
                          ? "structure"
                          : c.slug.includes("risk")
                            ? "risk"
                            : "foundations"
                      }
                    />
                  )}
                  <span className="student-explore-price-tag">
                    ₹{priceInRupees.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="student-explore-card-body">
                  <span className="student-explore-level-badge">{c.level}</span>
                  <h4>{c.title}</h4>
                  <p>{c.description}</p>

                  <ul className="student-explore-features">
                    <li>
                      <Check size={14} color="var(--accent, #00df8f)" />
                      <span>
                        {c.accessPeriod} {c.accessUnit} full access
                      </span>
                    </li>
                    <li>
                      <Check size={14} color="var(--accent, #00df8f)" />
                      <span>{c.modules.flatMap((m) => m.lessons).length} detailed lessons</span>
                    </li>
                    <li>
                      <Check size={14} color="var(--accent, #00df8f)" />
                      <span>Hindi audio instruction & notes</span>
                    </li>
                  </ul>

                  <div className="student-explore-card-footer">
                    {isOwned ? (
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={() => {
                          onSelectCoursesView();
                          const firstLesson =
                            c.modules.flatMap((m) => m.lessons).find((l) => !l.completed) ||
                            c.modules[0]?.lessons[0];
                          onOpenCourse(c.slug, firstLesson?.id || null);
                        }}
                      >
                        <CheckCircle size={16} color="var(--accent, #00df8f)" />
                        <span>Enrolled · Open course</span>
                      </button>
                    ) : (
                      <Link
                        className="button button-primary"
                        style={{ width: "100%", justifyContent: "center" }}
                        href={`/courses/${c.slug}`}
                      >
                        <span>View course & enroll</span>
                        <ArrowRight size={16} />
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="student-empty-state">
          <h3>No courses match your query</h3>
          <p>Try searching with different terms or reset the level filter.</p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              setExploreQuery("");
              setExploreLevel("all");
            }}
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
