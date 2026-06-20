"use client";

import { useCallback, useEffect, useState } from "react";
import { AppNotification } from "@/lib/notifications";
import {
  markNotificationSeen,
  NOTIFICATION_SEEN_EVENT,
  readSeenNotificationIds,
} from "@/lib/notification-read-state";

function isSupportNotificationId(id: string): boolean {
  return id.startsWith("support-");
}

function isSupportNotificationUnread(
  item: AppNotification,
  seen: Set<string>
): boolean {
  if (isSupportNotificationId(item.id)) {
    return item.unread === true;
  }
  return !seen.has(item.id);
}

export function useNotificationReadState(
  notifications: AppNotification[],
  sheetOpen: boolean
) {
  const [seenIds, setSeenIds] = useState<string[]>(readSeenNotificationIds);
  const notificationIdsKey = notifications.map((item) => item.id).join("|");

  const refreshSeenIds = useCallback(() => {
    setSeenIds(readSeenNotificationIds());
  }, []);

  const markSeen = useCallback((ids: string | string[]) => {
    markNotificationSeen(ids);
    refreshSeenIds();
  }, [refreshSeenIds]);

  useEffect(() => {
    const handleSeen = () => refreshSeenIds();
    window.addEventListener(NOTIFICATION_SEEN_EVENT, handleSeen);
    return () => window.removeEventListener(NOTIFICATION_SEEN_EVENT, handleSeen);
  }, [refreshSeenIds]);

  useEffect(() => {
    if (!sheetOpen) return;

    const idsToMark = notificationIdsKey
      .split("|")
      .filter((id) => id.length > 0 && !isSupportNotificationId(id));

    if (idsToMark.length > 0) {
      markNotificationSeen(idsToMark);
      refreshSeenIds();
    }
  }, [sheetOpen, notificationIdsKey, refreshSeenIds]);

  const seen = new Set(seenIds);
  const hasUnread =
    notifications.length > 0 &&
    notifications.some((item) => isSupportNotificationUnread(item, seen));

  const withUnreadState = notifications.map((item) => ({
    ...item,
    unread: isSupportNotificationUnread(item, seen),
  }));

  return { hasUnread, markSeen, seenIds: seen, notifications: withUnreadState };
}
