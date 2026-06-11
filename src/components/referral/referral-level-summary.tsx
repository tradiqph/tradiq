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
  onViewNetwork?: () => void;
}

export function ReferralLevelSummary({
  profile,
  onViewNetwork,
}: ReferralLevelSummaryProps) {
  const stats = normalizeReferralStats(profile.referralStats);
  const levels = getReferralLevelSummaries(stats);
  const totals = getReferralTotals(stats);

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-3 px-4 pb-1">
        <StatTile
          label="Directs"
          value={totals.directMembers}
          icon={Users}
          reserveHintSpace={Boolean(onViewNetwork)}
          className="min-w-0 flex-1 basis-0"
        />
        <StatTile
          label="Network"
          value={totals.totalMembers}
          icon={Users}
          onClick={onViewNetwork}
          hint={onViewNetwork ? "Tap to view" : undefined}
          className="min-w-0 flex-1 basis-0"
        />
        <StatTile
          label="Total earned"
          value={totals.totalEarned}
          icon={Gift}
          peso
          gold
          reserveHintSpace={Boolean(onViewNetwork)}
          className="min-w-0 flex-1 basis-0"
        />
      </div>

      <div className="surface-flat overflow-hidden">
        <div className="border-b border-white/5 px-4 py-3">
          <p className="text-sm font-semibold text-white">Level summary</p>
          <p className="text-xs text-zinc-500">
            One-time commission when a referral subscribes to a bot — not
            deposits or their daily bot earnings
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
                      {level.percent}% one-time at bot subscription
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
                  <p className="text-zinc-500">Bot subs</p>
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
              <p className="text-zinc-500">Bot subs</p>
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
