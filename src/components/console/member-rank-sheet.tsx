"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ConsoleError } from "@/components/console/console-error";
import { ConsoleLoader } from "@/components/console/console-loader";
import { RankCard } from "@/components/rank/rank-card";
import { PesoAmount } from "@/components/ui/peso-amount";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import type { MemberRank } from "@/lib/ranks/config";
import type { RankMetrics, RankProgressCard } from "@/lib/ranks/progress";
import { cn } from "@/lib/utils";

interface MemberRankSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    displayName: string;
    email: string;
  } | null;
}

interface RankProgressResponse {
  currentRank: MemberRank;
  currentBadge: string;
  rankActivatedAt: string | null;
  metrics: RankMetrics;
  ranks: RankProgressCard[];
  error?: string;
}

function formatManilaDateTime(value: string | null): string {
  if (!value) return "Not activated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not activated";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white/[0.02] p-3",
        highlight
          ? "border-amber-500/40 ring-1 ring-amber-500/20"
          : "border-white/5"
      )}
    >
      <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
      {sub ? <p className="mt-0.5 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

export function MemberRankSheet({
  open,
  onOpenChange,
  member,
}: MemberRankSheetProps) {
  const { user } = useAuth();
  const [data, setData] = useState<RankProgressResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRankProgress = useCallback(async () => {
    if (!user || !member) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/console/members/${member.id}/rank-progress`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const json = (await res.json()) as RankProgressResponse;
      if (!res.ok) {
        setError(json.error ?? "Failed to load rank progress");
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [user, member]);

  useEffect(() => {
    if (open && member) {
      void fetchRankProgress();
    } else if (!open) {
      setData(null);
      setError(null);
    }
  }, [open, member, fetchRankProgress]);

  const rankWithoutActivation =
    data &&
    data.currentRank !== "member" &&
    !data.rankActivatedAt;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-amber-500/20 bg-zinc-950 text-white sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="text-left text-white">
            Rank Progress
            {member ? (
              <span className="mt-1 block text-sm font-normal text-zinc-400">
                {member.displayName || member.email}
              </span>
            ) : null}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pt-2">
          {error ? (
            <ConsoleError message={error} />
          ) : loading ? (
            <ConsoleLoader variant="section" label="Loading rank progress" />
          ) : data ? (
            <>
              {rankWithoutActivation ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Rank set without activation timestamp. Badge may not be
                    legitimate.
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <SummaryCard
                  label="Current Rank"
                  value={data.currentBadge}
                  highlight
                />
                <SummaryCard
                  label="Activated At"
                  value={formatManilaDateTime(data.rankActivatedAt)}
                />
                <SummaryCard
                  label="Personal Investment"
                  value={<PesoAmount amount={data.metrics.personalInvestment} />}
                />
                <SummaryCard
                  label="Qualified L1 / Total L1"
                  value={`${data.metrics.qualifiedDirectReferrals} / ${data.metrics.directReferralCount}`}
                  sub={
                    data.metrics.eachReferralMet
                      ? "Each L1 invested ≥ ₱10,000"
                      : "Not all L1 meet ₱10,000"
                  }
                />
                <SummaryCard
                  label="Group Sales"
                  value={<PesoAmount amount={data.metrics.groupSales} />}
                  sub="Downline bot subscription volume"
                />
              </div>

              <div className="space-y-4">
                {data.ranks.map((rank) => (
                  <RankCard key={rank.id} rank={rank} readOnly />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
