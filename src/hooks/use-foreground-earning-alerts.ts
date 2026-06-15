"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FOREGROUND_KINDS } from "@/components/notifications/foreground-earning-alert";
import { useTransactions } from "@/hooks/use-transactions";
import {
  buildTransactionNotifications,
  type AppNotification,
} from "@/lib/notifications";
import { preloadNotificationSound } from "@/lib/notification-sound";

export function useForegroundEarningAlerts() {
  const { transactions, referralSourceNames } = useTransactions();
  const seenTxIdsRef = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<AppNotification[]>([]);

  const dismissCurrent = useCallback(() => {
    setQueue((current) => current.slice(1));
  }, []);

  useEffect(() => {
    const preload = () => preloadNotificationSound();
    window.addEventListener("pointerdown", preload, { once: true });
    window.addEventListener("keydown", preload, { once: true });
    return () => {
      window.removeEventListener("pointerdown", preload);
      window.removeEventListener("keydown", preload);
    };
  }, []);

  useEffect(() => {
    if (transactions.length === 0) return;

    const currentIds = new Set(transactions.map((tx) => tx.id));

    if (seenTxIdsRef.current === null) {
      seenTxIdsRef.current = currentIds;
      return;
    }

    const newTxs = transactions.filter(
      (tx) => !seenTxIdsRef.current!.has(tx.id)
    );
    seenTxIdsRef.current = currentIds;

    if (newTxs.length === 0 || document.visibilityState !== "visible") return;

    const alerts = buildTransactionNotifications(
      newTxs,
      referralSourceNames
    ).filter((item) => FOREGROUND_KINDS.has(item.kind));

    if (alerts.length === 0) return;

    setQueue((current) => [...current, ...alerts]);
  }, [transactions, referralSourceNames]);

  return { queue, dismissCurrent };
}
