"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "./auth-provider";
export function CourseAccessAction({
  slug,
  previewId,
  mobile = false,
  demoEnabled = false,
  courseId,
  paymentsUnavailable = false,
  isAdmin = false,
}: {
  slug: string;
  previewId?: string;
  mobile?: boolean;
  demoEnabled?: boolean;
  courseId?: string;
  paymentsUnavailable?: boolean;
  isAdmin?: boolean;
}) {
  const [owned, setOwned] = useState(false);
  const { user } = useAuth();
  const isAdminUser = isAdmin || user?.role === "admin";
  useEffect(() => {
    let live = true;
    fetch(`/api/learning/course?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d?.course?.owned === true) setOwned(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [slug]);
  if (owned || isAdminUser)
    return (
      <Link className="button button-primary" href={`/learn/${slug}`}>
        {isAdminUser ? "Open course classroom" : mobile ? "Go to course" : "Go to your course"}
      </Link>
    );
  if (mobile)
    return demoEnabled ? (
      <Link className="button button-primary" href={`/checkout/${slug || courseId}`}>
        Buy now
      </Link>
    ) : (
      <button className="button button-primary" disabled>
        {paymentsUnavailable ? "Payments temporarily unavailable" : "Enrolment not open"}
      </button>
    );
  return (
    <>
      {demoEnabled ? (
        <Link className="button button-primary" href={`/checkout/${slug || courseId}`}>
          Buy now
        </Link>
      ) : (
        <button className="button button-primary" disabled>
          {paymentsUnavailable ? "Payments temporarily unavailable" : "Enrolment opens later"}
        </button>
      )}
      {previewId && (
        <Link className="button button-secondary" href={`/learn/${slug}?lesson=${previewId}`}>
          Watch a free lesson
        </Link>
      )}
    </>
  );
}
