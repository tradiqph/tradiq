"use client";

import { GoldButton } from "@/components/ui/gold-button";
import { RankProgressBar } from "@/components/rank/rank-progress-bar";
import { RankRequirementChecklist } from "@/components/rank/rank-requirement-checklist";
import {
  formatPercentComplete,
  formatRankStatus,
} from "@/lib/ranks/display";
import type { RankProgressCard } from "@/lib/ranks/progress";
import { cn } from "@/lib/utils";

interface RankCardProps {
  rank: RankProgressCard;
  activating?: boolean;
  readOnly?: boolean;
  onActivate?: (rankId: RankProgressCard["id"]) => void;
}

export function RankCard({
  rank,
  activating,
  readOnly,
  onActivate,
}: RankCardProps) {
  const statusLabel =
    rank.status === "eligible"
      ? formatRankStatus("eligible")
      : rank.status === "activated"
        ? formatRankStatus("activated")
        : formatPercentComplete(rank.percentComplete);

  return (
    <div
      className={cn(
        "surface-flat space-y-4 p-4",
        rank.status === "activated" && "border-emerald-500/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">{rank.badge}</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Status:{" "}
            <span
              className={cn(
                "font-medium",
                rank.status === "eligible"
                  ? "text-amber-300"
                  : rank.status === "activated"
                    ? "text-emerald-400"
                    : "text-zinc-300"
              )}
            >
              {statusLabel}
            </span>
          </p>
        </div>
        {rank.status === "activated" ? (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
            Activated
          </span>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
          Benefits
        </p>
        <ul className="space-y-1.5">
          {rank.benefits.map((benefit) => (
            <li key={benefit} className="text-sm text-zinc-300">
              {benefit}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
          Requirements
        </p>
        <RankRequirementChecklist items={rank.checklist} />
      </div>

      <div className="space-y-3">
        {rank.progressBars.map((bar) => (
          <RankProgressBar key={bar.label} progress={bar} />
        ))}
      </div>

      {!readOnly && rank.status !== "activated" ? (
        <div className="space-y-2 pt-1">
          <GoldButton
            className="w-full"
            disabled={!rank.canActivate || activating}
            onClick={() => onActivate?.(rank.id)}
          >
            {activating ? "Activating..." : rank.activateLabel}
          </GoldButton>
          {!rank.canActivate && rank.disabledReason ? (
            <p className="text-center text-xs text-zinc-500">
              {rank.disabledReason}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
