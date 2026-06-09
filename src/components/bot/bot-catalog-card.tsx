"use client";

import { useState } from "react";
import Image from "next/image";
import { BarChart3 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { BotTrackRecordSheet } from "@/components/bot/bot-track-record-sheet";
import { BotCatalogItem } from "@/types";
import { cn } from "@/lib/utils";

interface BotCatalogCardProps {
  bot: BotCatalogItem & { id?: string; rank: number };
}

export function BotCatalogCard({ bot }: BotCatalogCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const winColor =
    bot.winRate >= 98
      ? "text-emerald-400"
      : bot.winRate >= 90
        ? "text-amber-400"
        : "text-yellow-500";

  return (
    <>
      <GlassCard variant="flat" className="mx-4 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-400">
              {bot.rank}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Image
                  src={bot.avatarUrl}
                  alt={bot.name}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
                <h3 className="font-bold text-white">{bot.name}</h3>
                {bot.isActive && (
                  <Badge className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-400">
                    LIVE
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-500">{bot.strategy}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn("text-lg font-bold", winColor)}>
              {bot.winRate}%
            </p>
            <p className="text-[10px] text-zinc-500">WIN RATE</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { label: "PNL", value: bot.pnl, green: true },
            { label: "Volume", value: bot.volume },
            { label: "Trades", value: bot.trades },
            { label: "Avg Hold", value: bot.avgHold },
          ].map(({ label, value, green }) => (
            <div
              key={label}
              className="rounded-lg bg-black/40 p-2 text-center"
            >
              <p
                className={cn(
                  "text-xs font-bold",
                  green ? "text-emerald-400" : "text-white"
                )}
              >
                {value}
              </p>
              <p className="text-[9px] text-zinc-500">{label}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-black/40 py-2 text-xs text-zinc-400 hover:border-amber-500/40 hover:text-white cursor-pointer"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          View track record
        </button>
      </GlassCard>

      <BotTrackRecordSheet
        bot={bot}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
