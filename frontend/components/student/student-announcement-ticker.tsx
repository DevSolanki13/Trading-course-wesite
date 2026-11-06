"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { MegaphoneSimple, Pause, Play, PushPin } from "@phosphor-icons/react";
import type { Announcement } from "../../../shared/announcements";
import "../../styles/announcement-ticker.css";

export function StudentAnnouncementTicker({ announcements }: { announcements: Announcement[] }) {
  const active = announcements.filter((announcement) => announcement.active);
  return active.length ? <AnnouncementTicker announcements={active} /> : null;
}

function AnnouncementTicker({ announcements }: { announcements: Announcement[] }) {
  const region = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [automaticallyPaused, setAutomaticallyPaused] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, duration: 30 });

  useEffect(() => {
    const measure = () => {
      const width = viewport.current?.clientWidth ?? 0;
      const groupWidth = Math.max(width, group.current?.scrollWidth ?? 0);
      setDimensions({ width, duration: Math.max(20, groupWidth / 40) });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (viewport.current) observer?.observe(viewport.current);
    if (group.current) observer?.observe(group.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [announcements]);

  useEffect(() => {
    let visible = true;
    const update = () => setAutomaticallyPaused(document.hidden || !visible);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            update();
          });
    if (region.current) observer?.observe(region.current);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const trackStyle = {
    "--ticker-width": dimensions.width ? `${dimensions.width}px` : "100vw",
    "--ticker-duration": `${dimensions.duration}s`,
  } as CSSProperties;

  return (
    <section
      ref={region}
      className="announcement-ticker"
      aria-label="Announcements"
      data-paused={paused || automaticallyPaused}
    >
      <div className="announcement-ticker-label" aria-hidden="true">
        <MegaphoneSimple size={16} weight="fill" />
        <span>Announcements</span>
      </div>
      <div
        ref={viewport}
        className="announcement-ticker-viewport"
        tabIndex={0}
        role="group"
        aria-label="Announcement messages"
      >
        <div className="announcement-ticker-track" style={trackStyle} aria-hidden="true">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              ref={copy === 0 ? group : undefined}
              className={`announcement-ticker-group${copy ? " is-copy" : ""}`}
            >
              {announcements.map((announcement) => (
                <span key={announcement.id} className="announcement-ticker-item">
                  {announcement.priority !== "normal" && (
                    <span className={`announcement-ticker-priority ${announcement.priority}`}>
                      {announcement.priority}
                    </span>
                  )}
                  {announcement.pinned && <PushPin size={13} weight="fill" />}
                  <strong>{announcement.title}</strong>
                  <span className="announcement-ticker-message">
                    {announcement.content.replace(/\s+/g, " ").trim()}
                  </span>
                  <span className="announcement-ticker-separator">•</span>
                </span>
              ))}
            </div>
          ))}
        </div>
        <ul className="sr-only">
          {announcements.map((announcement) => (
            <li key={announcement.id}>
              {announcement.priority !== "normal" ? `${announcement.priority}. ` : ""}
              {announcement.pinned ? "Pinned. " : ""}
              {announcement.title}. {announcement.content}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className="announcement-ticker-control"
        onClick={() => setPaused((value) => !value)}
        aria-label={paused ? "Resume announcements" : "Pause announcements"}
        aria-pressed={paused}
        title={paused ? "Resume announcements" : "Pause announcements"}
      >
        {paused ? <Play size={15} weight="fill" /> : <Pause size={15} weight="fill" />}
      </button>
    </section>
  );
}
