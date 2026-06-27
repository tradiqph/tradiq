"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { QaTestModeBanner } from "@/components/qa/qa-test-mode-banner";
import { RankActivationSuccessDialog } from "@/components/rank/rank-activation-success-dialog";
import { RankCard } from "@/components/rank/rank-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import type { RankProgressCard } from "@/lib/ranks/progress";
import type { MemberRank, PromotableRank } from "@/lib/ranks/config";
import { toast } from "sonner";

interface RankProgressResponse {
  currentRank: MemberRank;
  currentBadge: string;
  ranks: RankProgressCard[];
  qaOverrideActive?: boolean;
}

export default function RankPromotionPage() {
  const { user, refreshProfile } = useAuth();
  const [data, setData] = useState<RankProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activatingRank, setActivatingRank] = useState<PromotableRank | null>(
    null
  );
  const [activationSuccess, setActivationSuccess] = useState<{
    badge: string;
    label: string;
    benefits: string[];
  } | null>(null);

  const loadProgress = useCallback(async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/rank/progress", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to load rank progress");
      }

      const json = (await res.json()) as RankProgressResponse;
      setData(json);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load rank progress"
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadProgress();
    const onFocus = () => void loadProgress();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadProgress]);

  const handleActivate = async (rankId: PromotableRank) => {
    if (!user) return;

    const activatedRank = data?.ranks.find((rank) => rank.id === rankId);

    setActivatingRank(rankId);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/rank/activate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rank: rankId }),
      });

      const body = (await res.json().catch(() => null)) as {
        error?: string;
        badge?: string;
      } | null;

      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to activate rank");
      }

      setActivationSuccess({
        badge: body?.badge ?? activatedRank?.badge ?? "Rank",
        label: activatedRank?.label ?? rankId,
        benefits: activatedRank?.benefits ?? [],
      });
      await refreshProfile();
      await loadProgress();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to activate rank"
      );
    } finally {
      setActivatingRank(null);
    }
  };

  return (
    <>
      <AppHeader
        title="Rank Promotion"
        showBack
        backHref="/account"
        rightBadge={data?.currentBadge}
      />

      <div className="space-y-4 px-4 pb-4">
        {data?.qaOverrideActive ? <QaTestModeBanner /> : null}
        {loading ? (
          <>
            <Skeleton className="h-72 w-full bg-zinc-800" />
            <Skeleton className="h-72 w-full bg-zinc-800" />
            <Skeleton className="h-72 w-full bg-zinc-800" />
          </>
        ) : (
          data?.ranks.map((rank) => (
            <RankCard
              key={rank.id}
              rank={rank}
              activating={activatingRank === rank.id}
              onActivate={handleActivate}
            />
          ))
        )}
      </div>

      <RankActivationSuccessDialog
        open={activationSuccess !== null}
        onOpenChange={(open) => {
          if (!open) setActivationSuccess(null);
        }}
        badge={activationSuccess?.badge ?? ""}
        label={activationSuccess?.label ?? ""}
        benefits={activationSuccess?.benefits ?? []}
      />
    </>
  );
}
