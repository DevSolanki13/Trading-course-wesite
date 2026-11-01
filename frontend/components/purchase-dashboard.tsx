"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { PurchaseUser, PurchaseCourse, PurchaseOrder } from "../../shared/purchase";
import { accessExpiryLabel } from "../../shared/course-access";
export function PurchaseDashboard({
  user,
  courses,
  orders,
  ordersOnly = false,
  local = false,
}: {
  user: PurchaseUser;
  courses: PurchaseCourse[];
  orders: PurchaseOrder[];
  ordersOnly?: boolean;
  local?: boolean;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const r = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw new Error("Sign out failed. Please retry.");
      router.push("/login");
      router.refresh();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Sign out failed. Please retry.");
      setLoggingOut(false);
    }
  }
  return (
    <main id="main-content" className="container learning-library">
      <header className="learning-heading">
        <div>
          <h1>{ordersOnly ? "Purchase history" : "My courses"}</h1>
          <p>
            Welcome, {user.name}.{" "}
            {local ? "Local demo learning space." : "Your courses and purchases, in one place."}
          </p>
          {local && user.role === "admin" && (
            <>
              <p>Demo administrator account. Production staff tools remain separate.</p>
              <Link className="button button-primary" href="/admin">
                Open admin workspace
              </Link>
            </>
          )}
        </div>
        <button
          className="button button-secondary"
          disabled={loggingOut}
          onClick={() => void logout()}
        >
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </header>
      <nav className="learning-tabs" aria-label="Dashboard sections">
        <Link href="/dashboard" aria-current={!ordersOnly ? "page" : undefined}>
          My courses
        </Link>
        <Link href="/dashboard/orders" aria-current={ordersOnly ? "page" : undefined}>
          Purchase history
        </Link>
        <Link href="/courses">Browse courses</Link>
        <Link href="/contact?topic=refund">Refund support</Link>
        {!local && <Link href="/learn">Learning library</Link>}
        {!local && <Link href="/account">Account & devices</Link>}
      </nav>
      {!ordersOnly &&
        (courses.length ? (
          <div className="learning-course-grid">
            {courses.map((course) => {
              const lessons = course.modules.flatMap((m) => m.lessons);
              const next = lessons.find((l) => !l.completed) ?? lessons[0];
              return (
                <article className="learning-course-card" key={course.id}>
                  <div className="learning-card-body">
                    <h2>{course.title}</h2>
                    <p>
                      {course.owned ? "Access until" : "Access expired"}:{" "}
                      {course.accessExpiresAt
                        ? accessExpiryLabel(course.accessExpiresAt)
                        : "Access unavailable"}
                    </p>
                    <p>{course.progress}% complete</p>
                    <progress
                      aria-label={`${course.title} completion`}
                      value={course.progress}
                      max={100}
                    />
                    <Link
                      className="button button-primary"
                      href={
                        !course.owned
                          ? `/checkout/${course.slug}`
                          : next
                            ? `/learn/${course.slug}/${next.id}`
                            : `/learn/${course.slug}`
                      }
                    >
                      {!course.owned
                        ? "Renew course access"
                        : course.progress === 100
                          ? "Review course"
                          : course.progress > 0
                            ? "Continue learning"
                            : "Start learning"}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <section className="learning-empty">
            <h2>No courses purchased yet.</h2>
            <p>Your courses appear here after confirmed payment.</p>
            <Link className="button button-primary" href="/courses">
              Explore courses
            </Link>
          </section>
        ))}
      {ordersOnly &&
        (orders.length ? (
          <div className="learning-orders">
            {orders.map((order) => (
              <article key={order.id}>
                <div className="learning-order-head">
                  <h2>{order.courseTitle}</h2>
                  <span className="learning-status">{order.status}</span>
                  <strong>
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: order.currency,
                    }).format(order.amount / 100)}
                  </strong>
                </div>
                <p>Order {order.id}</p>
                {order.accessExpiresAt && (
                  <p>Access ends: {accessExpiryLabel(order.accessExpiresAt)}</p>
                )}
                <p>
                  {new Date(order.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}{" "}
                  IST
                </p>
                {["paid", "refunded"].includes(order.status) ? (
                  <Link className="text-link" href={`/dashboard/orders/${order.id}/receipt`}>
                    Print receipt
                  </Link>
                ) : (
                  <Link className="text-link" href={`/checkout/${order.courseId}`}>
                    Return to course checkout
                  </Link>
                )}
              </article>
            ))}
          </div>
        ) : (
          <section className="learning-empty">
            <h2>No purchases yet.</h2>
            <Link className="button button-primary" href="/courses">
              Browse courses
            </Link>
          </section>
        ))}
    </main>
  );
}
