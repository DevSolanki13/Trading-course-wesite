"use client";

import { useState } from "react";
import { MegaphoneSimple, PushPin, X, ShieldCheck } from "@phosphor-icons/react";
import type { Announcement } from "../../../shared/announcements";

export interface StudentAnnouncementsPanelProps {
  announcementsList: Announcement[];
}

export function StudentAnnouncementsPanel({ announcementsList }: StudentAnnouncementsPanelProps) {
  const [announcementsCollapsed, setAnnouncementsCollapsed] = useState(false);
  const [activeAnnouncementIndex, setActiveAnnouncementIndex] = useState(0);

  if (announcementsList.length === 0) {
    return null;
  }

  const current = announcementsList[activeAnnouncementIndex] || announcementsList[0];
  if (!current) return null;

  if (announcementsCollapsed) {
    return (
      <div className="student-announcements-wrapper">
        <div
          className="student-announcement-collapsed-bar"
          onClick={() => setAnnouncementsCollapsed(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setAnnouncementsCollapsed(false);
          }}
        >
          <div className="collapsed-left">
            <span className="live-pulse-dot" />
            <MegaphoneSimple size={16} weight="fill" color="var(--accent, #00df8f)" />
            <strong>Admin Announcement:</strong>
            <span className="collapsed-title">{current.title}</span>
          </div>
          <button
            type="button"
            className="collapsed-action"
            onClick={(e) => {
              e.stopPropagation();
              setAnnouncementsCollapsed(false);
            }}
          >
            View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="student-announcements-wrapper">
      <div
        className={`student-announcement-card priority-${current.priority}`}
        role="region"
        aria-label="Admin Announcement"
      >
        <div className="announcement-header">
          <div className="announcement-badge-cluster">
            <span className="announcement-brand-badge">
              <span className="live-pulse-dot" />
              <MegaphoneSimple size={14} weight="fill" />
              ADMIN ANNOUNCEMENT
            </span>
            <span className="announcement-category-tag">{current.category}</span>
            {current.pinned && (
              <span className="announcement-pinned-tag">
                <PushPin size={12} weight="fill" /> Pinned
              </span>
            )}
            {current.priority === "urgent" && (
              <span className="announcement-priority-tag urgent">⚡ Urgent</span>
            )}
            {current.priority === "important" && (
              <span className="announcement-priority-tag important">⭐ Important</span>
            )}
          </div>

          <div className="announcement-header-right">
            {announcementsList.length > 1 && (
              <div className="announcement-pagination">
                <button
                  type="button"
                  disabled={activeAnnouncementIndex === 0}
                  onClick={() => setActiveAnnouncementIndex((prev) => Math.max(0, prev - 1))}
                  aria-label="Previous announcement"
                >
                  ‹
                </button>
                <span>
                  {activeAnnouncementIndex + 1} of {announcementsList.length}
                </span>
                <button
                  type="button"
                  disabled={activeAnnouncementIndex >= announcementsList.length - 1}
                  onClick={() =>
                    setActiveAnnouncementIndex((prev) =>
                      Math.min(announcementsList.length - 1, prev + 1),
                    )
                  }
                  aria-label="Next announcement"
                >
                  ›
                </button>
              </div>
            )}
            <button
              type="button"
              className="announcement-dismiss-btn"
              onClick={() => setAnnouncementsCollapsed(true)}
              aria-label="Minimize announcement"
              title="Minimize announcement"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="announcement-body">
          <h3>{current.title}</h3>
          <p>{current.content}</p>
        </div>

        <div className="announcement-footer">
          <span className="announcement-author-info">
            <ShieldCheck size={14} weight="fill" color="var(--accent, #00df8f)" />
            Broadcasted by {current.author_name || "Admin"}
          </span>
          <span className="announcement-date">
            {new Date(current.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
