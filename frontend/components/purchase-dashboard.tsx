"use client";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { PurchaseUser, PurchaseCourse, PurchaseOrder } from "../../shared/purchase";
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
  async function logout() {
    const r = await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (r.ok) {
      router.push("/login");
      router.refresh();
    } else toast.error("Sign out failed. Please retry.");
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
            <p>Demo administrator account. Production staff tools remain separate.</p>
          )}
        </div>
        <button className="button button-secondary" onClick={() => void logout()}>
          Sign out
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
                    <p>{course.progress}% complete</p>
                    <progress
                      aria-label={`${course.title} completion`}
                      value={course.progress}
                      max={100}
                    />
                    <Link
                      className="button button-primary"
                      href={next ? `/learn/${course.slug}/${next.id}` : `/learn/${course.slug}`}
                    >
                      {course.progress === 100
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
