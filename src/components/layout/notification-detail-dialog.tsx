"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPeso } from "@/lib/finance";
import {
  getNotificationKindIcon,
  getNotificationKindIconStyle,
} from "@/lib/notification-icons";
import {
  AppNotification,
  formatNotificationFullDate,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

interface NotificationDetailDialogProps {
  notification: AppNotification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationDetailDialog({
  notification,
  open,
  onOpenChange,
}: NotificationDetailDialogProps) {
  if (!notification) return null;

  const Icon = getNotificationKindIcon(notification.kind);
  const fullDate = formatNotificationFullDate(notification.createdAt ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="border border-violet-500/30 bg-zinc-950 text-white sm:max-w-sm"
      >
        <div className="flex flex-col items-center pt-2 text-center">
          <div
            className={cn(
              "mb-4 flex h-14 w-14 items-center justify-center rounded-full",
              getNotificationKindIconStyle(notification.kind)
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
          <DialogTitle className="text-lg font-bold text-white">
            {notification.title}
          </DialogTitle>
          {fullDate && (
            <p className="mt-1 text-xs tracking-wide text-zinc-500">{fullDate}</p>
          )}
        </div>

        {notification.amount != null && (
          <div className="rounded-xl border border-white/5 bg-zinc-900 px-4 py-4 text-center">
            <p className="text-[10px] font-medium tracking-widest text-zinc-500">
              AMOUNT
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-white">
              {formatPeso(notification.amount)}
            </p>
          </div>
        )}

        <p className="text-center text-sm leading-relaxed text-zinc-400">
          {notification.body}
        </p>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-2 w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 cursor-pointer"
        >
          Close
        </button>
      </DialogContent>
    </Dialog>
  );
}
