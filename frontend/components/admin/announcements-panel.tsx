"use client";

import { useEffect, useState } from "react";
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
  Sparkle,
  ShieldCheck,
  X,
} from "@phosphor-icons/react";
import type { Announcement, AnnouncementPriority } from "../../../shared/announcements";

export function AnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showComposer, setShowComposer] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("General");
  const [priority, setPriority] = useState<AnnouncementPriority>("important");
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Deleting state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadAnnouncements() {
    try {
      const res = await fetch("/api/announcements?all=true", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load announcements");
      setAnnouncements(data.announcements || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching announcements");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/announcements?all=true", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.announcements && Array.isArray(data.announcements)) {
          setAnnouncements(data.announcements);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error fetching announcements");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Please provide both title and announcement message.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/announcements", {
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish announcement");

      toast.success("Admin announcement published! Students will now see this on their dashboard.");
      setTitle("");
      setContent("");
      setCategory("General");
      setPriority("important");
      setPinned(false);
      setShowComposer(false);
      await loadAnnouncements();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish announcement.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(item: Announcement) {
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: item.id,
          active: !item.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      toast.success(
        item.active
          ? "Announcement hidden from students' dashboard."
          : "Announcement is now active on students' dashboard.",
      );
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, active: !a.active } : a)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error updating status.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to permanently delete this announcement?")) return;
    setDeletingId(id);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");

      toast.success("Announcement deleted.");
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error deleting announcement.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="admin-announcements-panel">
      {/* Top Section Header */}
      <div className="admin-section-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span
              className="auth-section-label"
              style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
            >
              <MegaphoneSimple size={14} weight="fill" color="var(--accent, #00df8f)" />
              Broadcasts
            </span>
          </div>
          <h2>Admin Announcements</h2>
          <p>
            Publish announcements, live session invites, and updates directly to the students&apos;
            dashboard.
          </p>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={() => setShowComposer((prev) => !prev)}
        >
          {showComposer ? <X size={16} /> : <Plus size={16} />}
          <span>{showComposer ? "Close composer" : "New announcement"}</span>
        </button>
      </div>

      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}

      {/* Composer Card */}
      {showComposer && (
        <div className="admin-panel admin-composer-panel" style={{ marginBottom: "28px" }}>
          <div className="admin-composer-head">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div className="admin-composer-icon">
                <Sparkle size={18} weight="fill" color="var(--accent, #00df8f)" />
              </div>
              <div>
                <h3>Compose Admin Announcement</h3>
                <p>
                  Broadcasts will show prominently at the top of every enrolled student&apos;s
                  dashboard.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="admin-ghost-btn"
              onClick={() => setShowComposer(false)}
              aria-label="Close composer"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handlePublish} className="admin-form" style={{ marginTop: "18px" }}>
            <div className="admin-field-group">
              <label htmlFor="announcement-title">
                Announcement title <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="announcement-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., 🔴 Live Session: Nifty & BankNifty Breakdown this Friday at 7 PM IST"
                required
                maxLength={180}
              />
            </div>

            <div
              className="admin-form-row"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}
            >
              <div className="admin-field-group">
                <label htmlFor="announcement-category">Category</label>
                <select
                  id="announcement-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="General">📢 General Update</option>
                  <option value="Live Session">🔴 Live Session</option>
                  <option value="Market Update">📈 Market Insight</option>
                  <option value="Curriculum">📚 Curriculum Update</option>
                  <option value="Important">⚠️ Important Notice</option>
                </select>
              </div>

              <div className="admin-field-group">
                <label htmlFor="announcement-priority">Priority level</label>
                <select
                  id="announcement-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                >
                  <option value="normal">🟢 Normal (Info)</option>
                  <option value="important">🟡 Important (Highlighted)</option>
                  <option value="urgent">🔴 Urgent (High Alert)</option>
                </select>
              </div>

              <div
                className="admin-field-group"
                style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    padding: "10px 14px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "var(--foreground, #ffffff)",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={pinned}
                    onChange={(e) => setPinned(e.target.checked)}
                    style={{ accentColor: "var(--accent, #00df8f)", width: "16px", height: "16px" }}
                  />
                  <PushPin
                    size={16}
                    weight={pinned ? "fill" : "regular"}
                    color={pinned ? "var(--accent, #00df8f)" : "inherit"}
                  />
                  <span>Pin to top of student dashboard</span>
                </label>
              </div>
            </div>

            <div className="admin-field-group">
              <label htmlFor="announcement-content">
                Announcement message <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <textarea
                id="announcement-content"
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write the full message, joining instructions, links, or details for your learners..."
                required
                maxLength={4000}
              />
              <span className="admin-field-help">
                Line breaks and links will be neatly preserved on the student screen.
              </span>
            </div>

            {/* Live Preview Box */}
            <div className="admin-announcement-preview-wrap">
              <span className="admin-preview-label">
                <Eye size={14} /> Live Student Dashboard Preview
              </span>
              <div className={`student-announcement-preview-card priority-${priority}`}>
                <div className="preview-top-bar">
                  <div className="preview-badge-group">
                    <span className="preview-admin-pill">
                      <MegaphoneSimple size={13} weight="fill" />
                      ADMIN ANNOUNCEMENT
                    </span>
                    <span className="preview-category-pill">{category}</span>
                    {pinned && (
                      <span className="preview-pinned-pill">
                        <PushPin size={12} weight="fill" /> PINNED
                      </span>
                    )}
                    {priority === "urgent" && (
                      <span className="preview-urgent-pill">⚡ URGENT</span>
                    )}
                    {priority === "important" && (
                      <span className="preview-important-pill">⭐ IMPORTANT</span>
                    )}
                  </div>
                  <span className="preview-time-label">Just now</span>
                </div>

                <h4 className="preview-title">
                  {title || "Your Announcement Headline Will Appear Here"}
                </h4>
                <p className="preview-content">
                  {content ||
                    "This is a live preview showing how students will read your broadcast when they open their dashboard."}
                </p>

                <div className="preview-footer">
                  <span className="preview-author-tag">
                    <ShieldCheck size={14} weight="fill" color="var(--accent, #00df8f)" />
                    Verified Admin Broadcast
                  </span>
                </div>
              </div>
            </div>

            <div
              className="admin-form-actions"
              style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}
            >
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
                <span>{submitting ? "Publishing…" : "Publish to students"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Announcements List */}
      <div className="admin-panel">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "16px", margin: 0 }}>Active & past broadcasts</h3>
            <p className="admin-help" style={{ margin: "4px 0 0" }}>
              Manage broadcasts visible to enrolled learners.
            </p>
          </div>
          <span style={{ fontSize: "12px", color: "var(--muted, #8b949e)" }}>
            {announcements.length} {announcements.length === 1 ? "announcement" : "announcements"}
          </span>
        </div>

        {loading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              padding: "12px 0",
            }}
            role="status"
            aria-label="Loading broadcasts"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: "16px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  className="admin-skeleton admin-skeleton-title"
                  style={{ width: "40%", marginBottom: 8 }}
                />
                <div
                  className="admin-skeleton admin-skeleton-text"
                  style={{ width: "85%", marginBottom: 8 }}
                />
                <div className="admin-skeleton admin-skeleton-text" style={{ width: "30%" }} />
              </div>
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="admin-empty-state" style={{ padding: "40px 20px", textAlign: "center" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                margin: "0 auto 12px",
                borderRadius: "50%",
                background: "rgba(0, 223, 143, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent, #00df8f)",
              }}
            >
              <MegaphoneSimple size={24} weight="duotone" />
            </div>
            <h4 style={{ margin: "0 0 6px", fontSize: "15px" }}>No announcements published yet</h4>
            <p
              style={{
                margin: "0 auto 18px",
                maxWidth: "420px",
                fontSize: "13px",
                color: "var(--muted, #8b949e)",
              }}
            >
              Publish your first announcement to share live trading schedules, market updates, or
              curriculum alerts with your students.
            </p>
            <button
              type="button"
              className="button button-primary button-sm"
              onClick={() => setShowComposer(true)}
            >
              <Plus size={15} />
              <span>Compose announcement</span>
            </button>
          </div>
        ) : (
          <div className="admin-announcements-list">
            {announcements.map((item) => (
              <div
                key={item.id}
                className={`admin-announcement-row ${!item.active ? "is-inactive" : ""}`}
              >
                <div className="admin-announcement-main">
                  <div className="admin-announcement-tags">
                    {item.active ? (
                      <span className="admin-status-badge is-active">
                        <CheckCircle size={12} weight="fill" /> Live on dashboard
                      </span>
                    ) : (
                      <span className="admin-status-badge is-hidden">
                        <EyeSlash size={12} /> Hidden / Inactive
                      </span>
                    )}

                    <span className="admin-category-badge">{item.category}</span>

                    {item.pinned && (
                      <span className="admin-pinned-badge">
                        <PushPin size={12} weight="fill" /> Pinned
                      </span>
                    )}

                    {item.priority === "urgent" && (
                      <span className="admin-priority-badge is-urgent">⚡ Urgent</span>
                    )}
                    {item.priority === "important" && (
                      <span className="admin-priority-badge is-important">⭐ Important</span>
                    )}

                    <span className="admin-date-badge">
                      <Clock size={12} />
                      {new Date(item.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <h4 className="admin-announcement-title">{item.title}</h4>
                  <p className="admin-announcement-body">{item.content}</p>

                  <div className="admin-announcement-meta">
                    <span>Published by {item.author_name}</span>
                  </div>
                </div>

                <div className="admin-announcement-actions">
                  <button
                    type="button"
                    className="button button-secondary button-sm"
                    onClick={() => void handleToggleActive(item)}
                    title={item.active ? "Hide from students" : "Make visible to students"}
                  >
                    {item.active ? <EyeSlash size={15} /> : <Eye size={15} />}
                    <span>{item.active ? "Hide" : "Show"}</span>
                  </button>

                  <button
                    type="button"
                    className="button button-secondary button-sm admin-delete-btn"
                    onClick={() => void handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    title="Delete announcement"
                  >
                    <Trash size={15} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
