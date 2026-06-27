"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Gift, Lock } from "lucide-react";
import { RankProgressBar } from "@/components/rank/rank-progress-bar";
import { RankRequirementChecklist } from "@/components/rank/rank-requirement-checklist";
import { GoldButton } from "@/components/ui/gold-button";
import {
  formatRewardGroupSalesPercent,
  formatRewardValue,
  getRewardGroupSalesPercent,
  type RewardTierProgress,
} from "@/lib/rewards/config";
import { cn } from "@/lib/utils";

interface RewardTierCardProps {
  tier: RewardTierProgress;
  onClaim?: () => void;
  readOnly?: boolean;
}

export function RewardTierCard({
  tier,
  onClaim,
  readOnly = false,
}: RewardTierCardProps) {
  const [imageError, setImageError] = useState(false);
  const isEligible = tier.state === "eligible";
  const isClaimed = tier.state === "claimed";
  const isLocked = tier.state === "locked";
  const groupSalesBar = tier.progressBars.find((bar) => bar.label === "Group Sales");
  const groupSalesPercent = getRewardGroupSalesPercent(
    groupSalesBar?.current ?? 0,
    groupSalesBar?.target ?? tier.threshold
  );

  return (
    <div
      className={cn(
        "surface-flat overflow-hidden rounded-2xl border p-4",
        isEligible && "border-amber-500/30 ring-1 ring-amber-500/10",
        isClaimed && "border-emerald-500/20 opacity-90",
        isLocked && "border-white/5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <div
            className={cn(
              "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-800/90",
              isEligible && "border-amber-500/30",
              isClaimed && "border-emerald-500/30"
            )}
          >
            {!imageError ? (
              <Image
                src={tier.imageSrc}
                alt={tier.imageAlt}
                fill
                className="object-contain p-1 brightness-110"
                sizes="56px"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Gift className="h-5 w-5 text-zinc-500" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
              {tier.label}
            </p>
            <p className="mt-1 text-base font-semibold text-white">{tier.name}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {formatRewardValue(tier.threshold)}
            </p>
          </div>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            isEligible && "bg-amber-500/15",
            isClaimed && "bg-emerald-500/15",
            isLocked && "bg-zinc-800"
          )}
        >
          {isClaimed ? (
            <Check className="h-5 w-5 text-emerald-400" />
          ) : isLocked ? (
            <Lock className="h-5 w-5 text-zinc-500" />
          ) : (
            <Gift className="h-5 w-5 text-amber-400" />
          )}
        </div>
      </div>

      {!isClaimed && (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-zinc-400">Group sales progress</span>
              <span className="text-zinc-300">
                {formatRewardGroupSalesPercent(
                  groupSalesBar?.current ?? 0,
                  groupSalesBar?.target ?? tier.threshold
                )}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all"
                style={{ width: `${groupSalesPercent}%` }}
              />
            </div>
          </div>
          <RankRequirementChecklist items={tier.checklist} />
          {tier.progressBars.map((bar) => (
            <RankProgressBar key={bar.label} progress={bar} />
          ))}
        </div>
      )}

      <div className="mt-4">
        {readOnly ? (
          <div
            className={cn(
              "rounded-xl border px-3 py-2 text-center text-xs font-medium",
              isClaimed &&
                "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
              isEligible &&
                "border-amber-500/20 bg-amber-500/5 text-amber-400",
              isLocked && "border-white/5 bg-white/[0.02] text-zinc-500"
            )}
          >
            {isClaimed ? "Claimed" : isEligible ? "Eligible" : "Locked"}
          </div>
        ) : isEligible ? (
          <GoldButton className="w-full" onClick={onClaim}>
            Claim Reward
          </GoldButton>
        ) : isClaimed ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-center text-xs font-medium text-emerald-400">
            Claimed
          </div>
        ) : (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-center text-xs text-zinc-500">
            {tier.disabledReason ?? "Requirements not yet met"}
          </div>
        )}
      </div>
    </div>
  );
}
