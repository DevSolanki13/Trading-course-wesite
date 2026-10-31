"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BookOpen, Play, ShieldCheck } from "@phosphor-icons/react";
import type { CourseView, LibraryView } from "../../shared/learning";
import { LearningError, learningApi } from "../lib/learning-api";
import { StudentRefundControl } from "./student-refund-control";
import type { RefundEvidence } from "../../shared/admin";

function LearningCard({ course }: { course: CourseView }) {
  const total = course.modules.reduce((n, m) => n + m.lessons.length, 0);
  return (
    <article className="learning-course-card">
      <div className="learning-card-art">
        <BookOpen size={34} />
        <span>
          {course.language} · {course.level}
        </span>
      </div>
      <div className="learning-card-body">
        <h2>{course.title}</h2>
        {course.accessExpiresAt && (
          <p>
            Access {course.owned ? "until" : "ended"}:{" "}
            {new Date(course.accessExpiresAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}{" "}
            IST
          </p>
        )}
        <p>{total} published lessons</p>
        <progress aria-label={`${course.title} completion`} max={100} value={course.progress} />
        <div className="learning-card-meta">
          <span>{course.progress}% complete</span>
          <Link
            className="text-link"
            href={`/learn/${course.slug}${course.resumeLessonId ? `?lesson=${course.resumeLessonId}` : ""}`}
          >
            {course.progress >= 100
              ? "Review course"
              : course.progress > 0
                ? "Continue learning"
                : "Start learning"}{" "}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export function LearningLibrary() {
  const router = useRouter();
  const [data, setData] = useState<LibraryView | null>(null);
  const [error, setError] = useState("");
  const [refundError, setRefundError] = useState("");
  const [tab, setTab] = useState("courses");
  const [refunds, setRefunds] = useState<
    {
      orderId: string;
      evidence: RefundEvidence;
      request: {
        id: string;
        state: string;
        reason: string;
        reviewNote: string | null;
        createdAt: string;
      } | null;
    }[]
  >([]);
  useEffect(() => {
    let active = true;
    Promise.allSettled([
      learningApi<LibraryView>("library"),
      fetch("/api/refunds", { cache: "no-store" }).then(async (r) => {
        const d = await r.json();
        if (!r.ok)
          throw new LearningError(d.error ?? "Refund status unavailable.", r.status, d.code);
        return d as { items: typeof refunds };
      }),
    ])
      .then(([value, refund]) => {
        if (active) {
          if (value.status === "rejected") throw value.reason;
          setData(value.value);
          if (refund.status === "fulfilled") setRefunds(refund.value.items ?? []);
          else
            setRefundError(
              "Refund status is temporarily unavailable. You can still use your courses. Refresh to check again.",
            );
        }
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof LearningError && e.status === 401) router.replace("/login?next=%2Flearn");
        else if (e.code === "DEVICE_LIMIT") router.replace("/auth/devices?next=%2Flearn");
        else setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [router]);
  return (
    <main id="main-content" className="container learning-library">
      <header className="learning-heading">
        <div>
          <span className="auth-section-label">Your classroom</span>
          <h1>Make room for understanding.</h1>
          <p>
            {data
              ? `Welcome${data.name ? `, ${data.name.split(" ")[0]}` : ""}. Pick up where you left off.`
              : "Your learning space, securely connected to your account."}
          </p>
        </div>
        <Link className="button button-secondary" href="/account">
          Account & devices <ShieldCheck size={17} />
        </Link>
      </header>
      <nav className="learning-tabs" aria-label="Learning sections">
        {[
          ["courses", "My courses"],
          ["orders", "Orders"],
          ["community", "Community"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {error ? (
        <div className="auth-error" role="alert">
          {error}
          <button className="text-link" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      ) : !data ? (
        <p role="status" className="learning-empty">
          Loading your learning space…
        </p>
      ) : (
        <>
          {tab === "courses" && (
            <>
              <div className="learning-section-heading">
                <h2>Your courses</h2>
                <span>{data.courses.length} in your library</span>
              </div>
              {data.courses.length ? (
                <div className="learning-course-grid">
                  {data.courses.map((c) => (
                    <LearningCard key={c.id} course={c} />
                  ))}
                </div>
              ) : (
                <section className="learning-empty">
                  <BookOpen size={36} />
                  <h2>Your next chapter is ahead.</h2>
                  <p>
                    Your courses appear here after payment is confirmed or access is granted.
                    Explore a course and try an available free lesson first.
                  </p>
                  <Link className="button button-primary" href="/courses">
                    Explore courses <ArrowUpRight size={17} />
                  </Link>
                </section>
              )}
              <section className="learning-browse">
                <div className="learning-section-heading">
                  <h2>Keep exploring</h2>
                  <Link className="text-link" href="/courses">
                    View catalogue <ArrowUpRight size={16} />
                  </Link>
                </div>
                {data.browse.length ? (
                  <div className="learning-browse-list">
                    {data.browse.map((c) => (
                      <Link href={`/learn/${c.slug}`} key={c.id}>
                        <div>
                          <h3>{c.title}</h3>
                          <p>
                            {c.language} · {c.level}
                          </p>
                        </div>
                        <span>
                          View curriculum <ArrowUpRight size={16} />
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p>
                    Published learning courses will appear here when the curriculum is ready. The
                    public catalogue currently contains illustrative course outlines.
                  </p>
                )}
              </section>
            </>
          )}
          {tab === "orders" && (
            <section>
              {refundError && (
                <p className="auth-error" role="status">
                  {refundError}
                </p>
              )}
              <div className="learning-section-heading">
                <h2>Order history</h2>
                <span>Amounts in INR · Times in IST</span>
              </div>
              {data.orders.length ? (
                <div className="learning-orders">
                  {data.orders.map((o) => (
                    <article key={o.id}>
                      <div className="learning-order-head">
                        <div>
                          <h3>{o.courseTitle}</h3>
                          <p>
                            {new Date(o.createdAt).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                            })}{" "}
                            IST
                          </p>
                        </div>
                        <span className="learning-status">{o.status}</span>
                        <strong>
                          {new Intl.NumberFormat("en-IN", {
                            style: "currency",
                            currency: "INR",
                          }).format(o.total / 100)}
                        </strong>
                      </div>
                      <p className="learning-order-id">Order {o.id}</p>
                      <StudentRefundControl
                        orderId={o.id}
                        evidence={
                          refunds.find((r) => r.orderId === o.id)?.evidence ?? {
                            eligible: false,
                            valid: false,
                            reason: "Eligibility is being checked.",
                          }
                        }
                        request={refunds.find((r) => r.orderId === o.id)?.request ?? null}
                      />
                      {["paid", "refunded"].includes(o.status) && (
                        <p className="learning-caption">
                          <a className="text-link" href={`/api/orders/${o.id}/document`}>
                            Download billing PDF
                          </a>
                          {" · "}
                          <a
                            className="text-link"
                            href={`/api/orders/${o.id}/document?format=html`}
                          >
                            Accessible HTML copy
                          </a>
                          {o.status === "refunded" && (
                            <>
                              {" "}
                              ·{" "}
                              <a
                                className="text-link"
                                href={`/api/orders/${o.id}/document?kind=credit_note`}
                              >
                                Refund credit note
                              </a>
                            </>
                          )}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="learning-empty">
                  <h2>No orders yet.</h2>
                  <p>
                    Confirmed and pending course orders will be shown here. Payments remain
                    unavailable.
                  </p>
                </div>
              )}
            </section>
          )}
          {tab === "community" && (
            <section className="learning-community">
              <span className="auth-section-label">Learn alongside others</span>
              <h2>A thoughtful space for learners.</h2>
              <p>
                Use only the official links published here. Trading outcomes are never guaranteed.
              </p>
              <div className="learning-community-grid">
                <article>
                  <h3>Public channels</h3>
                  {data.community.telegram ? (
                    <a
                      className="text-link"
                      href={data.community.telegram}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Telegram channel <ArrowUpRight size={17} />
                    </a>
                  ) : (
                    <p>Official Telegram channel has not been configured.</p>
                  )}
                  {data.community.instagram ? (
                    <a
                      className="text-link"
                      href={data.community.instagram}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Instagram <ArrowUpRight size={17} />
                    </a>
                  ) : (
                    <p>Official Instagram profile has not been configured.</p>
                  )}
                </article>
                <article>
                  <h3>Student community</h3>
                  {data.community.privateInvite ? (
                    <>
                      <a
                        className="button button-primary"
                        href={data.community.privateInvite}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Join student group <Play size={16} />
                      </a>
                      <p className="learning-caption">Time-limited invite. Keep it private.</p>
                    </>
                  ) : (
                    <p>
                      {data.community.eligible
                        ? "You qualify for the student group. An administrator needs to publish a current invite."
                        : "A qualifying active paid course is required for the private group."}
                    </p>
                  )}
                </article>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
