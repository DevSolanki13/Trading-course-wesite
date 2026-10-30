"use client";
import { useEffect, useState } from "react";
import { adminApi, operation, when } from "../../lib/admin-api";
type Task = {
  id: string;
  kind: string;
  state: string;
  user_id: string;
  request_id: string;
  created_at: string;
  note: string | null;
  qualifyingPaidAccessNow:boolean;
};
type Outbox = {
  id: string;
  subject: string;
  state: string;
  attempts: number;
  created_at: string;
  next_attempt_at: string;
};
type Audit = {
  id: number;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
};
export function OperationsPanel({ view }: { view: "operations" | "audit" }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [emails, setEmails] = useState<Outbox[]>([]);
  const [events, setEvents] = useState<Audit[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function load() {
    if (view === "audit") {
      const d = await adminApi<{ items: Audit[] }>(`audit?page=${page}`);
      setEvents(d.items);
    } else {
      const [t, e] = await Promise.all([
        adminApi<{ items: Task[] }>("tasks"),
        adminApi<{ items: Outbox[] }>("notifications"),
      ]);
      setTasks(t.items);
      setEmails(e.items);
    }
  }
  useEffect(() => {
    let active = true;
    if (view === "audit")
      adminApi<{ items: Audit[] }>(`audit?page=${page}`)
        .then((d) => {
          if (active) setEvents(d.items);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    else
      Promise.all([
        adminApi<{ items: Task[] }>("tasks"),
        adminApi<{ items: Outbox[] }>("notifications"),
      ])
        .then(([t, e]) => {
          if (active) {
            setTasks(t.items);
            setEmails(e.items);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [view, page]);
  async function complete(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setPending(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await operation("task_done", { id, note: String(f.get("note") ?? "").trim() });
      setMessage("The manual task was marked complete and audited.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Task could not save.");
      void load().catch(()=>{});
    } finally {
      setPending(false);
    }
  }
  return (
    <section>
      <div className="admin-section-head">
        <div>
          <h2>{view === "audit" ? "Security audit" : "Operations"}</h2>
          <p>
            {view === "audit"
              ? "Who changed what, and when. Audit entries are append-only."
              : "Manual community tasks and durable notification states."}
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="auth-message">
          {message}
        </p>
      )}
      {view === "audit" ? (
        <>
          <div className="admin-table-wrap">
            <table>
              <caption className="sr-only">Audit events</caption>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {events.map((a) => (
                  <tr key={a.id}>
                    <td>{when(a.created_at)}</td>
                    <td>{a.action}</td>
                    <td className="admin-break">{a.actor_id ?? "Operator/system"}</td>
                    <td className="admin-break">
                      {a.target_type}: {a.target_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <span>Page {page + 1}</span>
            <button disabled={!page} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button disabled={events.length < 50} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </>
      ) : (
        <div className="admin-two-column">
          <section className="admin-panel">
            <h3>Community removal</h3>
            <p className="admin-help">
              When the provider confirms a refund and no qualifying purchase remains, manually
              remove that learner from the private Telegram group. Hiding the link does not remove a
              member.
            </p>
            {tasks.length ? (
              tasks.map((t) => (
                <div className="admin-list-row" key={t.id}>
                  <div>
                    <strong>
                      {t.kind} · {t.state}
                    </strong>
                    <span className="admin-break">Student {t.user_id}</span>
                    <span>Opened {when(t.created_at)}</span>
                  </div>
                  {t.state==="open"&&t.qualifyingPaidAccessNow&&<p className="admin-help">This learner has qualifying paid access again. Keep their group membership; do not complete the removal task.</p>}
                  {t.state === "open" && !t.qualifyingPaidAccessNow && (
                    <form className="admin-inline-form" onSubmit={(e) => complete(e, t.id)}>
                      <label>
                        Completion note
                        <input
                          name="note"
                          required
                          minLength={5}
                          maxLength={1000}
                          placeholder="Confirmed removed in Telegram"
                        />
                      </label>
                      <button className="button button-secondary" disabled={pending}>
                        Mark done
                      </button>
                    </form>
                  )}
                </div>
              ))
            ) : (
              <p>No community tasks.</p>
            )}
          </section>
          <section className="admin-panel">
            <h3>Refund notifications</h3>
            <p className="admin-help">
              Recorded states are not proof of inbox delivery. Email delivery/retry setup remains an
              operational acceptance gate.
            </p>
            {emails.length ? (
              emails.map((m) => (
                <div className="admin-list-row" key={m.id}>
                  <div>
                    <strong>{m.subject}</strong>
                    <span>
                      {m.state} · {m.attempts} attempts
                    </span>
                    <span>{when(m.created_at)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p>No queued messages.</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
