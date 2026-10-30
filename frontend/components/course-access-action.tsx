"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export function CourseAccessAction({
  slug,
  previewId,
  mobile = false,
}: {
  slug: string;
  previewId?: string;
  mobile?: boolean;
}) {
  const [owned, setOwned] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/learning/course?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live) setOwned(d?.course?.owned === true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [slug]);
  if (owned)
    return (
      <Link className="button button-primary" href={`/learn/${slug}`}>
        {mobile ? "Go to course" : "Go to your course"}
      </Link>
    );
  const demoEnabled = process.env.NEXT_PUBLIC_PAYMENT_MODE === "demo";
  if (mobile)
    return demoEnabled ? (
      <Link className="button button-primary" href={`/checkout/${slug}`}>
        Buy now
      </Link>
    ) : (
      <button className="button button-primary" disabled>
        Enrolment not open
      </button>
    );
  return (
    <>
      {demoEnabled ? (
        <Link className="button button-primary" href={`/checkout/${slug}`}>
          Buy now
        </Link>
      ) : (
        <button className="button button-primary" disabled>
          Enrolment opens later
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
