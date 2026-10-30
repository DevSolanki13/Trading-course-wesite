"use client";
import { useEffect, useState } from "react";
import { adminApi, operation, when, money } from "../../lib/admin-api";
import type { StudentRow, StudentDetail } from "../../../shared/admin";
type List = { items: StudentRow[]; total: number };
export function StudentsPanel({ role }: { role: "admin" | "support" }) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<List | null>(null);
  const [selected, setSelected] = useState<StudentDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function load() {
    const d = await adminApi<List>(`students?q=${encodeURIComponent(search)}&page=${page}`);
    setItems(d);
  }
  useEffect(() => {
    let live = true;
    adminApi<List>(`students?q=${encodeURIComponent(search)}&page=${page}`)
      .then((d) => {
        if (live) setItems(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [search, page]);
  async function open(id: string) {
    setError("");
    try {
      setSelected(await adminApi<StudentDetail>(`student?id=${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Student unavailable.");
    }
  }
  async function run(action: string, data: unknown) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await operation(action, data);
      setMessage("Action saved and audited.");
      if (selected) await open(selected.profile.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section>
      <div className="admin-section-head">
        <div>
          <h2>Students</h2>
          <p>Inspect account access, progress and active devices.</p>
        </div>
      </div>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="auth-message" role="status">
          {message}
        </p>
      )}
      <form
        className="admin-inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setSearch(query.trim());
        }}
      >
        <label>
          Search name or email
          <input value={query} maxLength={120} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button className="button button-secondary">Search</button>
      </form>
      {!items ? (
        <p role="status">Loading students…</p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table>
              <caption className="sr-only">Student accounts</caption>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.items.map((s) => (
                  <tr key={s.id}>
                    <td>{s.full_name || "Unnamed learner"}</td>
                    <td className="admin-break">{s.email}</td>
                    <td>{s.role}</td>
                    <td>{s.blocked ? "Blocked" : "Active"}</td>
                    <td>
                      <button className="text-link" onClick={() => open(s.id)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <span>{items.total} accounts</span>
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button disabled={(page + 1) * 50 >= items.total} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </>
      )}
      {selected && (
        <section className="admin-panel admin-detail">
          <div className="admin-section-head">
            <div>
              <h3>{selected.profile.full_name || "Learner"}</h3>
              <p>
                {selected.profile.email} · {selected.profile.role}
              </p>
            </div>
            <button className="text-link" onClick={() => setSelected(null)}>
              Close detail
            </button>
          </div>
          <div className="admin-detail-grid">
            <div>
              <h4>Courses & grants</h4>
              {selected.enrollments.length ? (
                selected.enrollments.map((e) => (
                  <div className="admin-list-row" key={e.id}>
                    <div>
                      <strong>
                        {selected.courses.find((c) => c.id === e.course_id)?.title || e.course_id}
                      </strong>
                      <span>
                        {e.source} · {e.active ? "Active" : "Revoked"}
                      </span>
                    </div>
                    {role === "admin" && e.active && (
                      <button
                        className="text-link"
                        disabled={pending}
                        onClick={() =>
                          run("revoke", {
                            enrollmentId: e.id,
                            note: "Access revoked after owner review",
                          })
                        }
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p>No access grants yet.</p>
              )}
              <form
                className="admin-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run("grant", {
                    userId: selected.profile.id,
                    courseId: String(f.get("course")),
                    note: String(f.get("note") ?? "").trim(),
                  });
                }}
              >
                <label>
                  Grant a published course
                  <select name="course" required>
                    <option value="">Choose course</option>
                    {selected.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Grant reason
                  <input
                    name="note"
                    required
                    minLength={5}
                    maxLength={1000}
                    placeholder="Offline purchase, review access, or goodwill"
                  />
                </label>
                <button className="button button-primary" disabled={pending}>
                  Grant access
                </button>
              </form>
            </div>
            <div>
              <h4>Learning activity</h4>
              <p>
                {selected.progress.length} lesson records · {selected.devices.length} active devices
              </p>
              {selected.progress.slice(0, 20).map((p) => (
                <p key={p.lesson_id}>
                  {p.lesson_id} · {p.completed ? "Completed" : "In progress"} ·{" "}
                  {Math.round(p.watched_seconds)}s watched
                </p>
              ))}
              <h4>Orders</h4>
              {selected.orders.length ? (
                selected.orders.map((o) => (
                  <p key={o.id}>
                    {o.status} · {money(o.total_paise)} · {when(o.created_at)}
                  </p>
                ))
              ) : (
                <p>No orders.</p>
              )}
              {role === "admin" && selected.profile.role === "student" && (
                <div className="admin-stack admin-account-actions">
                  <button
                    className="button button-secondary"
                    disabled={pending}
                    onClick={() =>
                      run("block", {
                        userId: selected.profile.id,
                        blocked: !selected.profile.blocked,
                        note: selected.profile.blocked
                          ? "Owner-authorised account restoration"
                          : "Owner-authorised account block",
                      })
                    }
                  >
                    {selected.profile.blocked ? "Unblock account" : "Block account"}
                  </button>
                  <button
                    className="button button-secondary"
                    disabled={pending}
                    onClick={() =>
                      run("logout_student", {
                        userId: selected.profile.id,
                        note: "Owner-authorised session reset",
                      })
                    }
                  >
                    Sign out all devices
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </section>
  );
}
