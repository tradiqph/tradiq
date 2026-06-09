"use client";

import { useCallback, useEffect, useState } from "react";
import { AppNotification } from "@/lib/notifications";

const READ_KEY = "tradiq_notifications_read_at";
const SEEN_IDS_KEY = "tradiq_notifications_seen_ids";

function readSeenIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SEEN_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function persistSeenIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(READ_KEY, String(Date.now()));
  localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(ids));
}

export function useNotificationReadState(
  notifications: AppNotification[],
  sheetOpen: boolean
) {
  const [seenIds, setSeenIds] = useState<string[]>(readSeenIds);

  const markSeen = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setSeenIds((current) => {
      const merged = [...new Set([...current, ...ids])];
      persistSeenIds(merged);
      return merged;
    });
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    markSeen(notifications.map((item) => item.id));
  }, [sheetOpen, notifications, markSeen]);

  const seen = new Set(seenIds);
  const hasUnread =
    notifications.length > 0 &&
    notifications.some((item) => !seen.has(item.id));

  return { hasUnread, markSeen };
}
