"use client";

import { useEffect, useState } from "react";
import type { Announcement } from "../../shared/announcements";

const EMPTY: Announcement[] = [];
export const ANNOUNCEMENT_FRESH_MS = 60_000;

/** Server snapshots are fresh on mount; refresh visible pages at most once per minute. */
export function useAnnouncements(initial?: Announcement[], ownerId?: string) {
  const [snapshot, setSnapshot] = useState({ source: initial, items: initial ?? EMPTY });
  if (snapshot.source !== initial) setSnapshot({ source: initial, items: initial ?? EMPTY });

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    let lastRead = initial === undefined ? -Infinity : Date.now();
    const controller = new AbortController();
    const refresh = async () => {
      if (!alive || inFlight || document.hidden || Date.now() - lastRead < ANNOUNCEMENT_FRESH_MS)
        return;
      inFlight = true;
      lastRead = Date.now();
      try {
        const response = await fetch("/api/announcements", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (alive && response.ok && Array.isArray(data.announcements))
          setSnapshot({ source: initial, items: data.announcements });
      } catch {
        /* Keep the last confirmed snapshot during transient failures. */
      } finally {
        inFlight = false;
      }
    };
    if (initial === undefined) void refresh();
    const resume = () => void refresh();
    const timer = window.setInterval(resume, ANNOUNCEMENT_FRESH_MS);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      alive = false;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [initial, ownerId]);
  return snapshot.items;
}
