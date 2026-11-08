import Link from "next/link";
import type { Course } from "../content/courses";
import { formatPrice } from "../content/courses";
import { CourseArtwork } from "./course-artwork";
import Image from "next/image";
import { ArrowUpRight, Clock, BookOpen } from "./icons";
import { BrandMark } from "./bull-mark";

export function CourseCard({
  course,
  showBrandMark = false,
}: {
  course: Course;
  showBrandMark?: boolean;
}) {
  return (
    <article className="course-card">
      <Link
        href={`/courses/${course.slug}`}
        className="course-image-link"
        aria-label={`View course: ${course.title}`}
      >
        {course.thumbnailUrl ? (
          <Image
            unoptimized
            src={course.thumbnailUrl}
            alt={`${course.title} course thumbnail`}
            width={600}
            height={400}
            loading="lazy"
            className="course-cover-photo"
          />
        ) : (
          <CourseArtwork kind={course.artwork} />
        )}
        <span className="course-image-arrow">
          <ArrowUpRight size={24} />
        </span>
      </Link>
      <div className="course-card-body">
        <div className="course-tags">
          <span>{course.level}</span>
          <span>Hindi</span>
          {showBrandMark && <BrandMark height={28} className="course-card-brand" />}
        </div>
        <h3>
          <Link href={`/courses/${course.slug}`}>{course.title}</Link>
        </h3>
        <p>{course.summary}</p>
        <p>
          Access: {course.accessPeriod ?? 1}{" "}
          {(course.accessUnit ?? "months") === "months"
            ? course.accessPeriod === 1 || !course.accessPeriod
              ? "month"
              : "months"
            : course.accessPeriod === 1
              ? "day"
              : "days"}{" "}
          from payment
        </p>
        <div className="course-meta">
          <span>
            <BookOpen size={15} />
            {course.lessons} lessons
          </span>
          <span>
            <Clock size={15} />
            {course.duration}
          </span>
        </div>
        <div className="course-card-bottom">
          <div>
            <span className="preview-price-label">
              {course.provisional === false ? "Course price" : "Illustrative price"}
            </span>
            <strong>{formatPrice(course.price)}</strong>
          </div>
          <Link
            href={`/courses/${course.slug}`}
            className="text-link"
            aria-label={`Explore course: ${course.title}`}
          >
            Explore course <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
    </article>
  );
}
