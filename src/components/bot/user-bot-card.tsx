"use client";

import { format } from "date-fns";
import { Lock, Calendar, TrendingUp } from "lucide-react";
import { BotScalpChart } from "@/components/bot/bot-scalp-chart";
import { PesoAmount } from "@/components/ui/peso-amount";
import {
  enrichBotInvestment,
  type BotInvestmentData,
} from "@/lib/investments";
import { formatPeso } from "@/lib/finance";
import { UserBot } from "@/types";
import { cn } from "@/lib/utils";

interface UserBotCardProps {
  bot: UserBot & { id: string };
}

export function UserBotCard({ bot }: UserBotCardProps) {
  const data: BotInvestmentData = {
    amount: bot.amount,
    status: bot.status,
    dailyRate: bot.dailyRate,
    subscribedAt: bot.subscribedAt,
    lastAccruedAt: bot.lastAccruedAt,
    totalAccrued: bot.totalAccrued,
    daysAccrued: bot.daysAccrued,
    termDays: bot.termDays,
  };

  const enriched = enrichBotInvestment(data, "", bot.id);
  const isActive = bot.status === "active";
  const progress = Math.min(
    100,
    Math.round((enriched.daysAccrued / enriched.termDays) * 100)
  );
  const maturityLabel = enriched.maturityAt
    ? format(new Date(enriched.maturityAt), "MMM d, yyyy")
    : "—";

  return (
    <div className="surface-flat mx-4 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-bold text-white">Your Bot</span>
            {isActive && (
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-amber-400/90">
                <Lock className="h-3 w-3" />
                Capital locked · 30-day term
              </div>
            )}
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              isActive
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-zinc-800 text-zinc-500"
            )}
          >
            {bot.status.toUpperCase()}
          </span>
        </div>

        <PesoAmount amount={bot.amount} gold className="mt-2 text-2xl" />

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-white/5 bg-black/40 px-2.5 py-2">
            <p className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Calendar className="h-3 w-3" />
              Completes
            </p>
            <p className="mt-0.5 font-medium text-white">{maturityLabel}</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-black/40 px-2.5 py-2">
            <p className="flex items-center gap-1 text-[10px] text-zinc-500">
              <TrendingUp className="h-3 w-3" />
              Daily yield
            </p>
            <p className="mt-0.5 font-medium text-amber-400">
              {formatPeso(enriched.dailyDue)} (3%)
            </p>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] text-zinc-500">
            <span>
              Day {enriched.daysAccrued}/{enriched.termDays}
            </span>
            <span>{enriched.daysRemaining} days left</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <p className="mt-2 text-xs text-zinc-500">
          Earned: {formatPeso(bot.totalAccrued)} · Principal returns on
          completion
        </p>
      </div>

      {isActive && (
        <div className="border-t border-white/5 bg-black/30 px-4 py-3">
          <BotScalpChart botId={bot.id} />
        </div>
      )}
    </div>
  );
}
