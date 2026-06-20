"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { SupportNotificationItem } from "@/lib/support";

export function useSupportUnread() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<SupportNotificationItem[]>([]);

  const refetch = useCallback(async () => {
    if (!user) {
      setCount(0);
      setItems([]);
      return;
    }

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/support/unread", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = (await res.json()) as {
        count?: number;
        items?: SupportNotificationItem[];
      };
      setCount(data.count ?? 0);
      setItems(data.items ?? []);
    } catch {
      // Keep last known state on transient failures
    }
  }, [user]);

  const markRead = useCallback(
    async (ticketIds?: string[]) => {
      if (!user) return;

      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/support/tickets/read", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            ticketIds?.length ? { ticketIds } : {}
          ),
        });
        if (!res.ok) return;

        if (ticketIds?.length) {
          setItems((current) => {
            const next = current.map((item) =>
              ticketIds.includes(item.ticketId)
                ? { ...item, isUnread: false }
                : item
            );
            setCount(next.filter((item) => item.isUnread).length);
            return next;
          });
        } else {
          setCount(0);
          setItems((current) =>
            current.map((item) => ({ ...item, isUnread: false }))
          );
        }

        void refetch();
      } catch {
        // Keep badge until a successful read
      }
    },
    [user, refetch]
  );

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const onFocus = () => {
      void refetch();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refetch();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [refetch]);

  return { count, items, markRead, refetch };
}
