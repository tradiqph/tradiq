"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppNotification } from "@/lib/notifications";
import {
  markNotificationSeen,
  NOTIFICATION_SEEN_EVENT,
  readSeenNotificationIds,
} from "@/lib/notification-read-state";

export function useNotificationReadState(
  notifications: AppNotification[],
  sheetOpen: boolean,
  onSheetOpen?: () => void
) {
  const [seenIds, setSeenIds] = useState<string[]>(readSeenNotificationIds);
  const wasSheetOpenRef = useRef(false);
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
    const justOpened = sheetOpen && !wasSheetOpenRef.current;
    wasSheetOpenRef.current = sheetOpen;

    if (!sheetOpen) return;

    if (justOpened) {
      onSheetOpen?.();
    }

    if (notificationIdsKey.length > 0) {
      markNotificationSeen(notificationIdsKey.split("|"));
      refreshSeenIds();
    }
  }, [sheetOpen, notificationIdsKey, onSheetOpen, refreshSeenIds]);

  const seen = new Set(seenIds);
  const hasUnread =
    notifications.length > 0 &&
    notifications.some((item) => !seen.has(item.id));

  const withUnreadState = notifications.map((item) => ({
    ...item,
    unread: !seen.has(item.id),
  }));

  return { hasUnread, markSeen, seenIds: seen, notifications: withUnreadState };
}
