"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Headphones } from "lucide-react";
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

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.319 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export function AppHeader({
  title,
  showBack,
  backHref = "/home",
  rightBadge,
}: AppHeaderProps) {
  const { profile } = useAuth();
  const { transactions, referralSourceNames } = useTransactions(25);
  const {
    count: supportUnreadCount,
    items: supportNotificationItems,
    markRead: markSupportRead,
    refetch: refetchSupportNotifications,
  } = useSupportUnread();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    if (notificationsOpen) {
      void refetchSupportNotifications();
    }
  }, [notificationsOpen, refetchSupportNotifications]);

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

  const { markSeen, notifications } = useNotificationReadState(
    rawNotifications,
    notificationsOpen
  );

  const handleMarkSeen = useCallback(
    (id: string) => {
      markSeen(id);
      if (id.startsWith("support-")) {
        void markSupportRead([id.slice("support-".length)]);
      }
    },
    [markSeen, markSupportRead]
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

  const showBellBadge =
    !notificationsOpen &&
    notifications.some(
      (item) => item.unread && !item.id.startsWith("support-")
    );
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
          <div className="flex shrink-0 items-center gap-2">
            <a
              href="https://discord.gg/pA39BFgAS7"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-zinc-950 text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 cursor-pointer"
              aria-label="Join Discord"
            >
              <DiscordIcon className="h-4 w-4" />
            </a>
            <Link
              href="/account?support=1"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/5 bg-zinc-950 text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 cursor-pointer"
              aria-label="Open support"
            >
              <Headphones className="h-4 w-4" />
              {supportUnreadCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500" />
              )}
            </Link>
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-zinc-950 text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 cursor-pointer"
              aria-label="Open notifications"
            >
              <Bell className="h-4 w-4" />
              {showBellBadge && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500" />
              )}
            </button>
          </div>
        </div>
      </header>

      <NotificationsSheet
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        notifications={notifications}
        onMarkSeen={handleMarkSeen}
      />
    </>
  );
}
