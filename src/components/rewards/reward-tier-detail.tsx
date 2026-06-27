"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Gift } from "lucide-react";
import { RankProgressBar } from "@/components/rank/rank-progress-bar";
import { RankRequirementChecklist } from "@/components/rank/rank-requirement-checklist";
import { GoldButton } from "@/components/ui/gold-button";
import { formatPeso } from "@/lib/finance";
import {
  formatRewardGroupSalesPercent,
  type RewardTierProgress,
} from "@/lib/rewards/config";
import { cn } from "@/lib/utils";

interface RewardTierDetailProps {
  tier: RewardTierProgress;
  claimReference?: string | null;
  onClaim?: () => void;
  readOnly?: boolean;
}

export function RewardTierDetail({
  tier,
  claimReference,
  onClaim,
  readOnly = false,
}: RewardTierDetailProps) {
  const [imageError, setImageError] = useState(false);
  const isEligible = tier.state === "eligible";
  const isClaimed = tier.state === "claimed";
  const groupSalesBar = tier.progressBars.find((bar) => bar.label === "Group Sales");

  return (
    <div className="surface-flat space-y-3 rounded-2xl border border-white/5 p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-800/90",
            isEligible && "border-amber-500/30",
            isClaimed && "border-emerald-500/30"
          )}
        >
          {!imageError ? (
            <Image
              src={tier.imageSrc}
              alt={tier.imageAlt}
              fill
              className="object-contain p-1.5 brightness-110"
              sizes="64px"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Gift className="h-6 w-6 text-zinc-600" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            {tier.label}
          </p>
          <h3 className="mt-0.5 text-base font-bold leading-snug text-white">
            {tier.name}
          </h3>
          <p className="mt-1 text-[11px] text-zinc-500">
            Group sales: {formatPeso(groupSalesBar?.current ?? 0)} /{" "}
            {formatPeso(groupSalesBar?.target ?? tier.threshold)} (
            {formatRewardGroupSalesPercent(
              groupSalesBar?.current ?? 0,
              groupSalesBar?.target ?? tier.threshold
            )}
            )
          </p>
        </div>
      </div>

      {!readOnly && !isClaimed ? (
        isEligible && onClaim ? (
          <GoldButton className="w-full" onClick={onClaim}>
            Claim Reward
          </GoldButton>
        ) : (
          <div className="space-y-1.5">
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-semibold text-zinc-500"
            >
              Claim Reward
            </button>
            <p className="text-center text-[10px] text-zinc-500">
              Complete all requirements below to unlock claiming.
            </p>
          </div>
        )
      ) : null}

      {!readOnly && isEligible ? (
        <p className="text-center text-[10px] text-zinc-500">
          Claiming is optional — you can claim anytime while eligible.
        </p>
      ) : null}

      <div>
        <p className="mb-1.5 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
          Requirements
        </p>
        <RankRequirementChecklist items={tier.checklist} />
      </div>

      <div className="space-y-2.5">
        {tier.progressBars.map((bar) => (
          <RankProgressBar key={bar.label} progress={bar} />
        ))}
      </div>

      {isClaimed && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-400">
          <Check className="h-4 w-4 shrink-0" />
          <span>
            Claimed
            {claimReference ? (
              <span className="ml-1 font-mono text-xs text-emerald-300/80">
                · {claimReference}
              </span>
            ) : null}
          </span>
        </div>
      )}
    </div>
  );
}
