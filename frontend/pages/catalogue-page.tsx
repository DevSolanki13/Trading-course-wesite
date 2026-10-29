"use client";
import { useState } from "react";
import { courses } from "../content/courses";
import { CourseCard } from "../components/course-card";
import { ArrowDown, MagnifyingGlass } from "@phosphor-icons/react";

export default function CataloguePage() {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("All levels");
  const results = courses.filter(
    (course) =>
      (level === "All levels" || course.level === level) &&
      `${course.title} ${course.summary}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <main id="main-content" className="container catalogue-page">
      <div className="page-intro">
        <h1>
          A clearer path
          <br />
          through the markets.
        </h1>
        <p>
          Start with the basics, explore price action, or focus on the decisions behind the trade.
          Find a course that fits your next step.
        </p>
      </div>
      <div className="catalogue-toolbar">
        <div className="course-filter">
          <label htmlFor="course-level">Your starting point</label>
          <select id="course-level" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option>All levels</option>
            <option>Beginner</option>
            <option>Intermediate</option>
          </select>
        </div>
        <div className="course-search">
          <MagnifyingGlass size={20} />
          <label className="sr-only" htmlFor="course-search">
            Search courses
          </label>
          <input
            id="course-search"
            placeholder="Find a course"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="catalogue-results-heading">
        <h2>{level === "All levels" ? "Explore the courses" : `${level} courses`}</h2>
        <span aria-live="polite">
          {results.length} {results.length === 1 ? "course" : "courses"} <ArrowDown size={14} />
        </span>
      </div>
      {results.length ? (
        <div className="course-grid">
          {results.map((course) => (
            <CourseCard key={course.slug} course={course} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <MagnifyingGlass size={32} />
          <h2>No courses match that search.</h2>
          <p>Try a different topic or reset your filters.</p>
          <button
            className="button button-secondary"
            onClick={() => {
              setQuery("");
              setLevel("All levels");
            }}
          >
            Show all courses
          </button>
        </div>
      )}
      <p className="catalogue-note">
        Preview catalogue. All curriculum, counts, durations and prices are illustrative. Final
        course information and tax treatment will be confirmed before enrolment opens.
      </p>
    </main>
  );
}
