"use client";

import Link from "next/link";
import {
  Bell,
  Bot,
  Headphones,
  Shield,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AppNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const iconByType = {
  security: Shield,
  transaction: Wallet,
  earning: TrendingUp,
  system: Sparkles,
  support: Headphones,
};

interface NotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: AppNotification[];
}

export function NotificationsSheet({
  open,
  onOpenChange,
  notifications,
}: NotificationsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full border-amber-500/20 bg-zinc-950 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Bell className="h-4 w-4 text-amber-400" />
            Notifications
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-6">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Bell className="mb-3 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-400">You&apos;re all caught up</p>
            </div>
          ) : (
            notifications.map((item) => {
              const Icon = iconByType[item.type] ?? Bot;
              const content = (
                <div className="flex gap-3 rounded-xl border border-amber-500/10 bg-white/5 p-3 transition-colors hover:border-amber-500/25 hover:bg-white/[0.07]">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      item.type === "security" && "bg-amber-500/15 text-amber-400",
                      item.type === "transaction" && "bg-blue-500/10 text-blue-300",
                      item.type === "earning" && "bg-emerald-500/10 text-emerald-400",
                      item.type === "system" && "bg-purple-500/10 text-purple-300",
                      item.type === "support" && "bg-amber-500/15 text-amber-400"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        {item.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-zinc-500">
                        {item.time}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                      {item.body}
                    </p>
                  </div>
                </div>
              );

              if (item.href) {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className="block cursor-pointer"
                  >
                    {content}
                  </Link>
                );
              }

              return <div key={item.id}>{content}</div>;
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
