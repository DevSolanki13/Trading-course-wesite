"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

export function useLessonNotes(lessonId: string, userId?: string | null) {
  const [notes, setNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  // User-scoped storage key prevents note leaks between different accounts on shared devices
  const userScopedKey = userId
    ? `indianxtrade_notes_${userId}_${lessonId}`
    : `indianxtrade_notes_guest_${lessonId}`;

  // Load notes from localStorage for this lesson (scoped to current account)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem(userScopedKey);
        setNotes(saved ?? "");
        setSaveStatus("saved");
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [userScopedKey]);

  // Debounced auto-save notes to preserve changes without requiring manual button clicks
  useEffect(() => {
    if (!notes) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(userScopedKey, notes);
        setSaveStatus("saved");
      } catch {
        // ignore
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [notes, userScopedKey]);

  const saveNotes = () => {
    try {
      localStorage.setItem(userScopedKey, notes);
      setSaveStatus("saved");
      toast.success("Notes saved for this lesson.");
    } catch {
      toast.error("Could not save note to browser storage.");
    }
  };

  return {
    notes,
    setNotes,
    saveStatus,
    setSaveStatus,
    saveNotes,
    userScopedKey,
  };
}
