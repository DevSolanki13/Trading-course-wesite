"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  MegaphoneSimple,
  Plus,
  Trash,
  PushPin,
  CheckCircle,
  Eye,
  EyeSlash,
  Clock,
  X,
} from "@phosphor-icons/react";
import type { Announcement, AnnouncementPriority } from "../../../shared/announcements";
import { StudentAnnouncementTicker } from "../student/student-announcement-ticker";

async function readAnnouncements(signal?: AbortSignal): Promise<Announcement[]> {
  const response = await fetch("/api/announcements?all=true", { cache: "no-store", signal });
  const data = await response.json();
  if (!response.ok || !Array.isArray(data.announcements))
    throw new Error(data.error || "Announcements could not be loaded. Please try again.");
  return data.announcements;
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export function AnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("General");
  const [priority, setPriority] = useState<AnnouncementPriority>("normal");
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadAnnouncements() {
    setLoading(true);
    setError("");
    try {
      setAnnouncements(await readAnnouncements());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Announcements could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    readAnnouncements(controller.signal)
      .then(setAnnouncements)
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : "Announcements could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function handlePublish(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Add a title and ticker message.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: title.trim(),
          content: content.trim(),
          category,
          priority,
          pinned,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Announcement could not be published.");
      if (data.announcement) setAnnouncements((previous) => [data.announcement, ...previous]);
      toast.success("Announcement published to the student ticker.");
      setTitle("");
      setContent("");
      setCategory("General");
      setPriority("normal");
      setPinned(false);
      setShowComposer(false);
      await loadAnnouncements();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Announcement could not be published.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(item: Announcement) {
    setBusyId(item.id);
    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id: item.id, active: !item.active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Announcement could not be updated.");
      setAnnouncements((previous) =>
        previous.map((entry) =>
          entry.id === item.id ? { ...entry, active: !item.active } : entry,
        ),
      );
      toast.success(
        item.active ? "Announcement removed from the ticker." : "Announcement added to the ticker.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Announcement could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: Announcement) {
    if (
      !confirm(
        "Permanently delete this announcement? This also removes it from the student ticker.",
      )
    )
      return;
    setBusyId(item.id);
    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: item.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Announcement could not be deleted.");
      setAnnouncements((previous) => previous.filter((entry) => entry.id !== item.id));
      toast.success("Announcement deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Announcement could not be deleted.");
    } finally {
      setBusyId(null);
    }
  }

  const active = announcements.filter((item) => item.active);
  const draft: Announcement = {
    id: "ticker-draft",
    title: title.trim() || "Your announcement title",
    content: content.trim() || "Write a short update for your learners.",
    category,
    priority,
    pinned,
    active: true,
    author_name: "Preview",
    created_at: "1970-01-01T00:00:00Z",
    updated_at: "1970-01-01T00:00:00Z",
  };

  return (
    <section className="admin-announcements-panel" aria-label="Announcement management">
      <div className="admin-section-head">
        <div>
          <h2 id="announcements-title">Announcements</h2>
          <p>Manage the scrolling messages beneath the student dashboard header.</p>
        </div>
        <button
          type="button"
          className="button button-primary"
          disabled={submitting}
          onClick={() => setShowComposer((previous) => !previous)}
          aria-expanded={showComposer}
          aria-controls="announcement-composer"
        >
          {showComposer ? <X size={16} /> : <Plus size={16} />}
          {showComposer ? "Close composer" : "New announcement"}
        </button>
      </div>

      <div className="admin-announcement-preview-wrap">
        <div className="admin-announcement-preview-heading">
          <h3>{showComposer ? "Draft ticker preview" : "Student ticker preview"}</h3>
          <span>
            {showComposer
              ? "Only you can see this draft"
              : active.length + " active · " + (announcements.length - active.length) + " hidden"}
          </span>
        </div>
        {showComposer || active.length ? (
          <StudentAnnouncementTicker announcements={showComposer ? [draft] : active} />
        ) : (
          <p className="admin-help">
            {loading
              ? "Loading ticker messages…"
              : error
                ? "The ticker preview is unavailable until announcements load."
                : "The ticker is hidden when there are no active announcements."}
          </p>
        )}
        <p className="admin-help">
          The same ticker students see across their dashboard. Hover or use the pause button to
          read.
        </p>
      </div>

      {error && (
        <div className="admin-announcement-error" role="alert">
          <p className="auth-error">{error}</p>
          <button
            type="button"
            className="button button-secondary button-sm"
            onClick={() => void loadAnnouncements()}
          >
            Try again
          </button>
        </div>
      )}

      {showComposer && (
        <div className="admin-panel admin-composer-panel" id="announcement-composer">
          <div className="admin-composer-head">
            <div>
              <h3>New ticker announcement</h3>
              <p>Keep it brief so learners can read it as it scrolls.</p>
            </div>
          </div>
          <form onSubmit={handlePublish} className="admin-form admin-announcement-form">
            <div className="admin-field-group">
              <div className="admin-announcement-field-heading">
                <label htmlFor="announcement-title">Title</label>
                <span id="announcement-title-count">{title.length}/180</span>
              </div>
              <input
                id="announcement-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Friday live session"
                required
                maxLength={180}
                aria-describedby="announcement-title-count"
              />
            </div>
            <div className="admin-field-group">
              <div className="admin-announcement-field-heading">
                <label htmlFor="announcement-content">Ticker message</label>
                <span id="announcement-content-count">{content.length}/4000</span>
              </div>
              <textarea
                id="announcement-content"
                rows={3}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Share a short schedule update, lesson release, or notice."
                required
                maxLength={4000}
                aria-describedby="announcement-content-help announcement-content-count"
              />
              <p className="admin-field-help" id="announcement-content-help">
                Aim for one short sentence. Line breaks become spaces; links appear as plain text.
              </p>
            </div>
            <div className="admin-announcement-options">
              <div className="admin-field-group">
                <label htmlFor="announcement-category">Category</label>
                <select
                  id="announcement-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  aria-describedby="announcement-category-help"
                >
                  <option value="General">General update</option>
                  <option value="Live Session">Live session</option>
                  <option value="Market Update">Market insight</option>
                  <option value="Curriculum">Curriculum update</option>
                  <option value="Important">Important notice</option>
                </select>
                <p className="admin-field-help" id="announcement-category-help">
                  For organizing messages here; not shown in the ticker.
                </p>
              </div>
              <div className="admin-field-group">
                <label htmlFor="announcement-priority">Priority</label>
                <select
                  id="announcement-priority"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as AnnouncementPriority)}
                  aria-describedby="announcement-priority-help"
                >
                  <option value="normal">Normal</option>
                  <option value="important">Important · highlighted label</option>
                  <option value="urgent">Urgent · alert label</option>
                </select>
                <p className="admin-field-help" id="announcement-priority-help">
                  Important and urgent messages get a label in the ticker.
                </p>
              </div>
            </div>
            <label className="admin-pin-option">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(event) => setPinned(event.target.checked)}
              />
              <PushPin size={17} weight={pinned ? "fill" : "regular"} aria-hidden="true" />
              <span>
                <strong>Pin to front of ticker</strong>
                <small>Pinned announcements scroll before other messages.</small>
              </span>
            </label>
            <div className="admin-form-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setShowComposer(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className="button button-primary" disabled={submitting}>
                <MegaphoneSimple size={16} weight="fill" />
                {submitting ? "Publishing…" : "Publish to ticker"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-panel">
        <div className="admin-announcement-list-heading">
          <div>
            <h3>Published announcements</h3>
            <p className="admin-help">Show or hide messages in the student ticker.</p>
          </div>
          <span className="admin-help">{announcements.length} total</span>
        </div>
        {loading ? (
          <div
            role="status"
            aria-label="Loading announcements"
            className="admin-announcement-loading"
          >
            {[0, 1, 2].map((row) => (
              <div key={row} className="admin-skeleton admin-skeleton-title" />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="admin-announcement-empty">
            <MegaphoneSimple size={24} weight="duotone" />
            <h4>{error ? "Announcements are unavailable" : "No announcements yet"}</h4>
            <p>
              {error
                ? "Try loading them again."
                : "Publish a short update to start the student ticker."}
            </p>
            {!error && (
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setShowComposer(true)}
              >
                New announcement
              </button>
            )}
          </div>
        ) : (
          <div className="admin-announcements-list">
            {announcements.map((item) => (
              <article
                key={item.id}
                className={"admin-announcement-row" + (!item.active ? " is-inactive" : "")}
              >
                <div className="admin-announcement-main">
                  <div className="admin-announcement-tags">
                    <span
                      className={"admin-status-badge " + (item.active ? "is-active" : "is-hidden")}
                    >
                      {item.active ? (
                        <CheckCircle size={12} weight="fill" />
                      ) : (
                        <EyeSlash size={12} />
                      )}
                      {item.active ? "In ticker" : "Hidden"}
                    </span>
                    <span className="admin-category-badge">{item.category}</span>
                    {item.pinned && (
                      <span className="admin-pinned-badge">
                        <PushPin size={12} weight="fill" />
                        Pinned first
                      </span>
                    )}
                    {item.priority !== "normal" && (
                      <span className={"admin-priority-badge is-" + item.priority}>
                        {item.priority}
                      </span>
                    )}
                    <span className="admin-date-badge">
                      <Clock size={12} />
                      {Number.isFinite(Date.parse(item.created_at)) ? (
                        <time dateTime={item.created_at} title="Published date (IST)">
                          {dateFormatter.format(new Date(item.created_at))}
                        </time>
                      ) : (
                        "Date unavailable"
                      )}
                    </span>
                  </div>
                  <h4 className="admin-announcement-title">{item.title}</h4>
                  <p className="admin-announcement-body">
                    {item.content.replace(/\s+/g, " ").trim()}
                  </p>
                  <div className="admin-announcement-meta">
                    Published by {item.author_name || "Admin"}
                  </div>
                </div>
                <div className="admin-announcement-actions">
                  <button
                    type="button"
                    className="button button-secondary button-sm"
                    disabled={busyId !== null}
                    onClick={() => void handleToggleActive(item)}
                    aria-label={(item.active ? "Hide " : "Show ") + item.title}
                  >
                    {item.active ? <EyeSlash size={15} /> : <Eye size={15} />}
                    {item.active ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    className="button button-secondary button-sm admin-delete-btn"
                    disabled={busyId !== null}
                    onClick={() => void handleDelete(item)}
                    aria-label={"Delete " + item.title}
                  >
                    <Trash size={15} />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
