"use client";

import { Users, TrendingUp, Gift } from "lucide-react";
import { PesoAmount } from "@/components/ui/peso-amount";
import { StatTile } from "@/components/ui/stat-tile";
import { formatPeso } from "@/lib/finance";
import {
  getReferralLevelSummaries,
  getReferralTotals,
  normalizeReferralStats,
} from "@/lib/referral-stats";
import { UserProfile } from "@/types";

interface ReferralLevelSummaryProps {
  profile: UserProfile;
}

export function ReferralLevelSummary({ profile }: ReferralLevelSummaryProps) {
  const stats = normalizeReferralStats(profile.referralStats);
  const levels = getReferralLevelSummaries(stats);
  const totals = getReferralTotals(stats);

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        <StatTile
          label="Directs"
          value={totals.directMembers}
          icon={Users}
          className="min-w-[110px] shrink-0"
        />
        <StatTile
          label="Network"
          value={totals.totalMembers}
          icon={Users}
          className="min-w-[110px] shrink-0"
        />
        <StatTile
          label="Total earned"
          value={totals.totalEarned}
          icon={Gift}
          peso
          gold
          className="min-w-[120px] shrink-0"
        />
      </div>

      <div className="surface-flat overflow-hidden">
        <div className="border-b border-white/5 px-4 py-3">
          <p className="text-sm font-semibold text-white">Level summary</p>
          <p className="text-xs text-zinc-500">
            Commissions apply on bot investments only — not deposits
          </p>
        </div>

        <div className="divide-y divide-white/5">
          {levels.map((level) => (
            <div key={level.level} className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">
                    {level.level}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {level.label}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {level.percent}% per bot investment
                    </p>
                  </div>
                </div>
                <PesoAmount
                  amount={level.earned}
                  gold
                  className="text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-black/40 px-2 py-1.5">
                  <p className="text-zinc-500">Members</p>
                  <p className="font-semibold text-white">{level.members}</p>
                </div>
                <div className="rounded-lg bg-black/40 px-2 py-1.5">
                  <p className="text-zinc-500">Invested</p>
                  <p className="font-semibold text-white">
                    {formatPeso(level.invested)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-amber-500/10 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
            <span>All levels combined</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="text-zinc-500">Members</p>
              <p className="font-bold text-white">{totals.totalMembers}</p>
            </div>
            <div>
              <p className="text-zinc-500">Invested</p>
              <p className="font-bold text-white">
                {formatPeso(totals.totalInvested)}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Earned</p>
              <p className="font-bold text-amber-400">
                {formatPeso(totals.totalEarned)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
