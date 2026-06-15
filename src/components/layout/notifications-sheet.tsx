"use client";

import { useState } from "react";
import {
  Bell,
} from "lucide-react";
import { NotificationDetailDialog } from "@/components/layout/notification-detail-dialog";
import {
  getNotificationKindIcon,
  getNotificationKindIconStyle,
} from "@/lib/notification-icons";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AppNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";

interface NotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: AppNotification[];
  onMarkSeen: (id: string) => void;
}

export function NotificationsSheet({
  open,
  onOpenChange,
  notifications,
  onMarkSeen,
}: NotificationsSheetProps) {
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleSelect = (item: AppNotification) => {
    setSelected(item);
    setDetailOpen(true);
  };

  const handleDetailOpenChange = (nextOpen: boolean) => {
    setDetailOpen(nextOpen);
    if (!nextOpen) setSelected(null);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full border-violet-500/20 bg-zinc-950 sm:max-w-sm"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-white">
              <Bell className="h-4 w-4 text-violet-400" />
              Notifications
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Bell className="mb-3 h-8 w-8 text-zinc-600" />
                <p className="text-sm text-zinc-400">
                  You&apos;re all caught up
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const Icon = getNotificationKindIcon(item.kind);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full cursor-pointer text-left"
                  >
                    <div className="rounded-xl border border-violet-500/40 bg-zinc-900/80 p-3 transition-colors hover:border-violet-500/60 hover:bg-zinc-900">
                      <div className="flex gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                            getNotificationKindIconStyle(item.kind)
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <p className="flex-1 text-sm font-semibold text-white">
                              {item.title}
                            </p>
                            {item.unread && (
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-500" />
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                            {item.body}
                          </p>
                          <p className="mt-2 text-[10px] font-medium tracking-wide text-zinc-500">
                            {item.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      <NotificationDetailDialog
        notification={selected}
        open={detailOpen}
        onOpenChange={handleDetailOpenChange}
        onView={(item) => onMarkSeen(item.id)}
      />
    </>
  );
}
