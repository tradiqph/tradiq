"use client";

import { Bot, CalendarClock, Coins, TrendingUp } from "lucide-react";
import { PesoAmount } from "@/components/ui/peso-amount";
import { summarizeActiveBots } from "@/lib/bot-portfolio";
import { UserBot } from "@/types";

interface BotPortfolioSummaryProps {
  bots: (UserBot & { id: string })[];
}

export function BotPortfolioSummary({ bots }: BotPortfolioSummaryProps) {
  const summary = summarizeActiveBots(bots);

  return (
    <div className="mb-4 grid grid-cols-2 gap-2">
      <div className="surface-flat col-span-2 p-4">
        <div className="flex items-center gap-2 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
          <Coins className="h-3.5 w-3.5 text-amber-400" />
          Total bot investments
        </div>
        <p className="mt-1 text-xs text-zinc-500">Active bots only</p>
        <PesoAmount
          amount={summary.totalInvested}
          gold
          className="mt-2 text-2xl"
        />
      </div>

      <div className="surface-flat p-3">
        <TrendingUp className="mb-1.5 h-4 w-4 text-amber-400" />
        <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
          Estimated earnings
        </p>
        <p className="mt-0.5 text-[10px] text-zinc-600">Remaining interest</p>
        <PesoAmount
          amount={summary.estimatedEarnings}
          className="mt-1 text-lg text-white"
        />
      </div>

      <div className="surface-flat p-3">
        <Bot className="mb-1.5 h-4 w-4 text-amber-400" />
        <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
          Bots
        </p>
        <p className="mt-1 text-lg font-bold text-white">{summary.activeCount}</p>
        <p className="text-[10px] text-zinc-500">
          active
          {summary.completedCount > 0
            ? ` · ${summary.completedCount} completed`
            : ""}
        </p>
      </div>

      <div className="surface-flat col-span-2 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
              <CalendarClock className="h-3.5 w-3.5 text-amber-400" />
              Daily earnings
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-600">
              Combined 3% yield across active bots
            </p>
          </div>
          <PesoAmount
            amount={summary.dailyEarnings}
            gold
            className="text-xl"
          />
        </div>
      </div>
    </div>
  );
}
