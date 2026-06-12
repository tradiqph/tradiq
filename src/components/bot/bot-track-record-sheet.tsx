"use client";

import Image from "next/image";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { BotCatalogItem } from "@/types";
import { cn } from "@/lib/utils";

interface BotTrackRecordSheetProps {
  bot: (BotCatalogItem & { id?: string }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BotTrackRecordSheet({
  bot,
  open,
  onOpenChange,
}: BotTrackRecordSheetProps) {
  if (!bot) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl border-amber-500/20 bg-zinc-950">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3 text-left text-white">
            <Image
              src={bot.avatarUrl}
              alt={bot.name}
              width={40}
              height={40}
              className="rounded-full"
            />
            <div>
              <span className="block text-lg font-bold">{bot.name}</span>
              <span className="text-xs font-normal text-amber-400">
                {bot.strategy}
              </span>
            </div>
            {bot.isActive && (
              <Badge className="ml-auto border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                LIVE
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          {bot.description}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            { label: "All-time PNL", value: bot.pnl, green: true },
            { label: "7-day PNL", value: bot.weeklyPnl, green: true },
            { label: "Win rate", value: `${bot.winRate}%` },
            { label: "Last signal", value: bot.lastSignal },
            { label: "Volume", value: bot.volume },
            { label: "Trades", value: bot.trades },
            { label: "Avg hold", value: bot.avgHold },
            { label: "Rank", value: `#${bot.rank}` },
          ].map(({ label, value, green }) => (
            <div
              key={label}
              className="rounded-xl border border-amber-500/10 bg-black/40 p-3"
            >
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                {label}
              </p>
              <p
                className={cn(
                  "mt-1 text-sm font-bold",
                  green ? "text-emerald-400" : "text-white"
                )}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
