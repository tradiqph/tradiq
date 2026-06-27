"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Check, Lock, Star } from "lucide-react";
import { RewardTierDetail } from "@/components/rewards/reward-tier-detail";
import {
  MAX_REWARD_TRACK_SALES,
  type RewardTierProgress,
} from "@/lib/rewards/config";
import { cn } from "@/lib/utils";

interface RewardMilestoneTrackProps {
  groupSales: number;
  tiers: RewardTierProgress[];
  claimsByTier?: Record<string, string>;
  onClaim?: (tier: RewardTierProgress) => void;
}

function pickDefaultTier(tiers: RewardTierProgress[]): RewardTierProgress {
  const eligible = tiers.find((t) => t.state === "eligible");
  if (eligible) return eligible;
  const inProgress = tiers.find(
    (t) => t.state === "locked" && t.percentComplete > 0
  );
  if (inProgress) return inProgress;
  const firstLocked = tiers.find((t) => t.state === "locked");
  if (firstLocked) return firstLocked;
  return tiers[tiers.length - 1] ?? tiers[0]!;
}

function formatCompactThreshold(threshold: number): string {
  if (threshold >= 1_000_000) {
    return `₱${(threshold / 1_000_000).toFixed(0)}M sales`;
  }
  return `₱${(threshold / 1_000).toFixed(0)}K sales`;
}

export function RewardMilestoneTrack({
  groupSales,
  tiers,
  claimsByTier = {},
  onClaim,
}: RewardMilestoneTrackProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedTier = useMemo(() => {
    if (selectedId) {
      return tiers.find((t) => t.id === selectedId) ?? pickDefaultTier(tiers);
    }
    return pickDefaultTier(tiers);
  }, [selectedId, tiers]);

  const fillPercent = Math.min(
    100,
    (groupSales / MAX_REWARD_TRACK_SALES) * 100
  );

  return (
    <div className="space-y-3">
      <div className="surface-flat rounded-2xl border border-white/5 p-3">
        <div className="grid grid-cols-3 gap-1">
          {tiers.map((tier) => {
            const selected = selectedTier.id === tier.id;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => setSelectedId(tier.id)}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors",
                  selected
                    ? "bg-amber-500/10 ring-1 ring-amber-500/30"
                    : "hover:bg-white/[0.03]"
                )}
              >
                <div
                  className={cn(
                    "relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-800/90",
                    tier.state === "eligible" && "border-amber-500/40",
                    tier.state === "claimed" && "border-emerald-500/30",
                    tier.state === "locked" && "border-white/5"
                  )}
                >
                  <Image
                    src={tier.imageSrc}
                    alt={tier.imageAlt}
                    fill
                    className="object-contain p-0.5 brightness-110"
                    sizes="44px"
                  />
                </div>
                <p className="w-full truncate text-center text-[9px] leading-tight text-zinc-400">
                  {tier.shortName}
                </p>
                <StarMarker state={tier.state} active={selected} />
              </button>
            );
          })}
        </div>

        <div className="relative mt-3">
          <div className="relative h-1.5 rounded-full bg-zinc-800">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-700 to-amber-400 transition-all duration-500"
              style={{ width: `${fillPercent}%` }}
            />
            <div
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300 bg-amber-500 shadow-[0_0_6px_rgba(251,191,36,0.5)] transition-all duration-500"
              style={{ left: `${fillPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1">
          {tiers.map((tier) => (
            <p
              key={tier.id}
              className="text-center text-[9px] leading-tight text-zinc-500"
            >
              {formatCompactThreshold(tier.threshold)}
            </p>
          ))}
        </div>

        <p className="mt-3 text-center text-[10px] leading-snug text-zinc-500">
          Rewards unlock when all requirements are met. Claiming is optional.
        </p>
      </div>

      <RewardTierDetail
        tier={selectedTier}
        claimReference={claimsByTier[selectedTier.id] ?? null}
        onClaim={onClaim ? () => onClaim(selectedTier) : undefined}
      />
    </div>
  );
}

function StarMarker({
  state,
  active,
}: {
  state: RewardTierProgress["state"];
  active: boolean;
}) {
  if (state === "claimed") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (state === "eligible") {
    return (
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-400",
          !active && "animate-pulse"
        )}
      >
        <Star className="h-3.5 w-3.5 fill-amber-400" />
      </span>
    );
  }

  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-zinc-500">
      <Lock className="h-3 w-3" />
    </span>
  );
}
