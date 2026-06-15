"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationDetailDialog } from "@/components/layout/notification-detail-dialog";
import { formatPeso } from "@/lib/finance";
import {
  getNotificationKindIcon,
  getNotificationKindIconStyle,
  getNotificationSlideInStyle,
} from "@/lib/notification-icons";
import type { AppNotification, AppNotificationKind } from "@/lib/notifications";
import { markNotificationSeen } from "@/lib/notification-read-state";
import { cn } from "@/lib/utils";
import { playNotificationSound } from "@/lib/notification-sound";

const FOREGROUND_KINDS = new Set<AppNotificationKind>([
  "daily_earning",
  "final_earning",
  "principal_return",
  "referral_commission",
]);

interface ForegroundEarningAlertProps {
  alert: AppNotification | null;
  onDismiss: () => void;
}

function ForegroundEarningAlert({
  alert,
  onDismiss,
}: ForegroundEarningAlertProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (!alert) return;
    playNotificationSound();
    const timer = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [alert, onDismiss]);

  if (!alert) return null;

  const Icon = getNotificationKindIcon(alert.kind);

  return (
    <>
      <motion.button
        type="button"
        initial={{ y: -120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -120, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        onClick={() => setDetailOpen(true)}
        className="pointer-events-auto mx-4 w-[calc(100%-2rem)] max-w-md cursor-pointer text-left"
      >
        <div
          className={cn(
            "rounded-xl border bg-zinc-950/95 p-3 backdrop-blur-md",
            getNotificationSlideInStyle(alert.kind)
          )}
        >
          <div className="flex gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                getNotificationKindIconStyle(alert.kind)
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-white">{alert.title}</p>
                {alert.amount != null && (
                  <span className="shrink-0 text-sm font-bold text-emerald-400">
                    +{formatPeso(alert.amount)}
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-400">
                {alert.body}
              </p>
            </div>
          </div>
        </div>
      </motion.button>

      <NotificationDetailDialog
        notification={alert}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) onDismiss();
        }}
        onView={() => markNotificationSeen(alert.id)}
      />
    </>
  );
}

interface ForegroundEarningAlertsHostProps {
  queue: AppNotification[];
  onDismiss: () => void;
}

export function ForegroundEarningAlertsHost({
  queue,
  onDismiss,
}: ForegroundEarningAlertsHostProps) {
  const current = queue[0] ?? null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center pt-[max(0.75rem,env(safe-area-inset-top))]">
      <AnimatePresence mode="wait">
        {current && (
          <ForegroundEarningAlert
            key={current.id}
            alert={current}
            onDismiss={onDismiss}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export { FOREGROUND_KINDS };
