"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { NotificationsSheet } from "@/components/layout/notifications-sheet";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationReadState } from "@/hooks/use-notification-read";
import { useSupportUnread } from "@/hooks/use-support-unread";
import { useTransactions } from "@/hooks/use-transactions";
import {
  buildAppNotifications,
  buildSupportNotifications,
  sortNotificationsChronologically,
} from "@/lib/notifications";

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
  backHref?: string;
  rightBadge?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function AppHeader({
  title,
  showBack,
  backHref = "/home",
  rightBadge,
}: AppHeaderProps) {
  const { profile } = useAuth();
  const { transactions, referralSourceNames } = useTransactions(25);
  const { count: supportUnreadCount, items: supportNotificationItems, markRead: markSupportRead } =
    useSupportUnread();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const rawNotifications = useMemo(() => {
    const supportNotifications = buildSupportNotifications(
      supportNotificationItems
    );
    const appNotifications = buildAppNotifications(
      profile,
      transactions,
      referralSourceNames
    );
    return sortNotificationsChronologically([
      ...supportNotifications,
      ...appNotifications,
    ]);
  }, [profile, transactions, supportNotificationItems, referralSourceNames]);

  const handleNotificationsOpen = useCallback(() => {
    void markSupportRead();
  }, [markSupportRead]);

  const { hasUnread, markSeen, notifications } = useNotificationReadState(
    rawNotifications,
    notificationsOpen,
    handleNotificationsOpen
  );

  if (title) {
    return (
      <header className="flex items-center gap-3 px-4 py-4">
        {showBack ? (
          <Link
            href={backHref}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-zinc-950 text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className="w-9" />
        )}
        <div className="surface-accent flex-1 px-3 py-2">
          <h1 className="text-base font-bold text-white">{title}</h1>
        </div>
        {rightBadge ? (
          <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
            {rightBadge}
          </span>
        ) : (
          <span className="w-9" />
        )}
      </header>
    );
  }

  const showBadge =
    (hasUnread || supportUnreadCount > 0) && !notificationsOpen;
  const displayName = profile?.displayName ?? "Trader";

  return (
    <>
      <header className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-zinc-500">{getGreeting()}</p>
            <h1 className="truncate text-lg font-bold text-white">
              {displayName}
            </h1>
            <p className="text-[10px] font-semibold tracking-widest text-amber-400/80">
              TRADIQ
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-zinc-950 text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 cursor-pointer"
            aria-label="Open notifications"
          >
            <Bell className="h-4 w-4" />
            {showBadge && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500" />
            )}
          </button>
        </div>
      </header>

      <NotificationsSheet
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        notifications={notifications}
        onMarkSeen={(id) => markSeen(id)}
      />
    </>
  );
}
