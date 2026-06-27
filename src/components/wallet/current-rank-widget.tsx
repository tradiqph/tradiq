"use client";

import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import { getRankBadge } from "@/lib/ranks/display";
import { normalizeMemberRank } from "@/lib/ranks/config";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface CurrentRankWidgetProps {
  className?: string;
}

export function CurrentRankWidget({ className }: CurrentRankWidgetProps) {
  const { profile } = useAuth();
  const badge = getRankBadge(normalizeMemberRank(profile?.memberRank));

  return (
    <div className={cn("px-4 pb-2", className)}>
      <Link
        href="/account/rank-promotion"
        className="surface-flat flex items-center gap-3 p-4 transition-colors hover:bg-zinc-900/80"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
          <Crown className="h-5 w-5 text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            Current Rank
          </p>
          <p className="text-lg font-bold text-white">{badge}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
      </Link>
    </div>
  );
}
