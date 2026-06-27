"use client";

import { useCallback, useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { ConsoleError } from "@/components/console/console-error";
import { ConsoleLoader } from "@/components/console/console-loader";
import { RewardClaimDialog } from "@/components/rewards/reward-claim-dialog";
import { RewardClaimSuccessDialog } from "@/components/rewards/reward-claim-success-dialog";
import { RewardMilestoneTrack } from "@/components/rewards/reward-milestone-track";
import { QaTestModeBanner } from "@/components/qa/qa-test-mode-banner";
import { PesoAmount } from "@/components/ui/peso-amount";
import { useAuth } from "@/hooks/use-auth";
import type { RankMetrics } from "@/lib/ranks/progress";
import type { RewardTierProgress } from "@/lib/rewards/config";

interface RewardProgressResponse {
  groupSales: number;
  claimedRewardTiers: string[];
  tiers: RewardTierProgress[];
  metrics: RankMetrics;
  currentRank: string;
  currentBadge: string;
  claims: { rewardType: string; referenceNumber: string }[];
  qaOverrideActive?: boolean;
  error?: string;
}

export default function RewardsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<RewardProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimTier, setClaimTier] = useState<RewardTierProgress | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<{
    tier: RewardTierProgress;
    referenceNumber: string;
  } | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/rewards/progress", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as RewardProgressResponse;
      if (!res.ok) {
        setError(json.error ?? "Failed to load rewards");
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchProgress();
  }, [fetchProgress]);

  const openClaim = (tier: RewardTierProgress) => {
    if (tier.state !== "eligible") return;
    setClaimTier(tier);
    setClaimOpen(true);
  };

  const claimsByTier = Object.fromEntries(
    (data?.claims ?? []).map((c) => [c.rewardType, c.referenceNumber])
  );

  return (
    <>
      <AppHeader title="Rewards Center" showBack backHref="/home" />

      <div className="space-y-4 px-4 pb-6">
        {data?.qaOverrideActive ? <QaTestModeBanner /> : null}
        <div className="surface-accent p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
              <Gift className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                Your Group Sales
              </p>
              {loading ? (
                <div className="mt-1 h-7 w-24 animate-pulse rounded bg-zinc-800" />
              ) : (
                <PesoAmount
                  amount={data?.groupSales ?? 0}
                  className="text-2xl font-bold text-amber-400"
                />
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Unlock milestone rewards when all requirements are met. Each
            tier can be claimed once — claiming is optional.
          </p>
        </div>

        {loading ? (
          <ConsoleLoader label="Loading rewards…" />
        ) : error ? (
          <ConsoleError message={error} />
        ) : data ? (
          <RewardMilestoneTrack
            groupSales={data.groupSales}
            tiers={data.tiers}
            claimsByTier={claimsByTier}
            onClaim={openClaim}
          />
        ) : null}
      </div>

      <RewardClaimDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        tier={claimTier}
        onSuccess={({ referenceNumber }) => {
          if (claimTier) {
            setClaimSuccess({ tier: claimTier, referenceNumber });
          }
          void fetchProgress();
        }}
      />

      <RewardClaimSuccessDialog
        open={claimSuccess !== null}
        onOpenChange={(open) => {
          if (!open) setClaimSuccess(null);
        }}
        tier={claimSuccess?.tier ?? null}
        referenceNumber={claimSuccess?.referenceNumber ?? ""}
      />
    </>
  );
}
