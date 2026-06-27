"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ConsoleError } from "@/components/console/console-error";
import { ConsoleLoader } from "@/components/console/console-loader";
import { RewardTierCard } from "@/components/rewards/reward-tier-card";
import { PesoAmount } from "@/components/ui/peso-amount";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import type { RankMetrics } from "@/lib/ranks/progress";
import {
  REWARD_STATUS_LABELS,
  type RewardClaimStatus,
  type RewardTierProgress,
} from "@/lib/rewards/config";
import { formatPeso } from "@/lib/finance";
import { cn } from "@/lib/utils";

interface MemberRewardsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    displayName: string;
    email: string;
  } | null;
}

interface RewardClaimSummary {
  id: string;
  referenceNumber: string;
  rewardName: string;
  status: RewardClaimStatus;
  claimedAt: { seconds: number } | null;
}

interface RewardsProgressResponse {
  groupSales: number;
  lifetimeGroupSales?: number;
  claimedRewardTiers: string[];
  tiers: RewardTierProgress[];
  metrics: RankMetrics;
  currentBadge: string;
  claims: RewardClaimSummary[];
  error?: string;
}

function formatClaimDate(value: { seconds: number } | null | undefined): string {
  if (!value?.seconds) return "—";
  return format(new Date(value.seconds * 1000), "MMM d, yyyy");
}

function statusBadgeClass(status: RewardClaimStatus): string {
  switch (status) {
    case "pending":
      return "text-amber-400";
    case "processing":
      return "text-blue-400";
    case "shipped":
      return "text-violet-400";
    case "received":
      return "text-emerald-400";
    default:
      return "text-zinc-400";
  }
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

export function MemberRewardsSheet({
  open,
  onOpenChange,
  member,
}: MemberRewardsSheetProps) {
  const { user } = useAuth();
  const [data, setData] = useState<RewardsProgressResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRewardsProgress = useCallback(async () => {
    if (!user || !member) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/console/members/${member.id}/rewards-progress`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const json = (await res.json()) as RewardsProgressResponse;
      if (!res.ok) {
        setError(json.error ?? "Failed to load rewards progress");
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [user, member]);

  useEffect(() => {
    if (open && member) {
      void fetchRewardsProgress();
    } else if (!open) {
      setData(null);
      setError(null);
    }
  }, [open, member, fetchRewardsProgress]);

  const claimedCount = data?.tiers.filter((t) => t.state === "claimed").length ?? 0;
  const totalTiers = data?.tiers.length ?? 3;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-amber-500/20 bg-zinc-950 text-white sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="text-left text-white">
            Rewards Progress
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
            <ConsoleLoader variant="section" label="Loading rewards progress" />
          ) : data ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <SummaryCard
                  label="Reward Group Sales"
                  value={<PesoAmount amount={data.groupSales} />}
                  sub={
                    data.lifetimeGroupSales != null &&
                    data.lifetimeGroupSales !== data.groupSales
                      ? `Lifetime downline: ${formatPeso(data.lifetimeGroupSales)}`
                      : "Current milestone cycle"
                  }
                  highlight
                />
                <SummaryCard
                  label="Claimed Tiers"
                  value={`${claimedCount} / ${totalTiers}`}
                  sub={
                    data.claimedRewardTiers.length > 0
                      ? data.claimedRewardTiers.join(", ")
                      : "No tiers claimed yet"
                  }
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
              </div>

              {data.currentBadge ? (
                <p className="text-xs text-zinc-500">
                  Current rank: <span className="text-zinc-300">{data.currentBadge}</span>
                </p>
              ) : null}

              <div className="space-y-3">
                <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                  Milestone rewards
                </p>
                {data.tiers.map((tier) => (
                  <RewardTierCard key={tier.id} tier={tier} readOnly />
                ))}
              </div>

              {data.claims.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                      Submitted claims
                    </p>
                    <Link
                      href="/console/rewards"
                      className="text-[10px] text-amber-400 hover:text-amber-300"
                    >
                      Open Rewards console
                    </Link>
                  </div>
                  <ul className="space-y-2">
                    {data.claims.map((claim) => (
                      <li
                        key={claim.id}
                        className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-amber-400">
                              {claim.referenceNumber}
                            </p>
                            <p className="mt-1 text-sm text-white">
                              {claim.rewardName}
                            </p>
                            <p className="mt-0.5 text-xs text-zinc-500">
                              {formatClaimDate(claim.claimedAt)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                              statusBadgeClass(claim.status)
                            )}
                          >
                            {REWARD_STATUS_LABELS[claim.status]}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
