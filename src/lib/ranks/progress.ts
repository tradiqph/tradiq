import {
  getRankIndex,
  getRankTier,
  getPreviousRank,
  RANK_TIERS,
  type MemberRank,
  type PromotableRank,
  type RankTierConfig,
} from "@/lib/ranks/config";
import { normalizeReferralStats, type ReferralStats } from "@/lib/referral-stats";
import type { RankCardStatus } from "@/lib/ranks/display";

export interface RankMetrics {
  personalInvestment: number;
  qualifiedDirectReferrals: number;
  directReferralCount: number;
  groupSales: number;
}

export interface MetricProgress {
  current: number;
  target: number;
  percent: number;
  label: string;
}

export interface RequirementChecklistItem {
  id: string;
  label: string;
  met: boolean;
}

export interface RankProgressCard {
  id: PromotableRank;
  badge: string;
  label: string;
  benefits: string[];
  status: RankCardStatus;
  percentComplete: number;
  checklist: RequirementChecklistItem[];
  progressBars: MetricProgress[];
  canActivate: boolean;
  disabledReason: string | null;
  activateLabel: string;
}

function clampPercent(current: number, target: number): number {
  if (target <= 0) return 100;
  return Math.min(100, Math.round((current / target) * 100));
}

export function getPersonalInvestment(
  botAmounts: number[]
): number {
  return Math.round(botAmounts.reduce((sum, amount) => sum + amount, 0) * 100) / 100;
}

export async function fetchLifetimeBotInvestmentByUserIds(
  db: import("firebase-admin/firestore").Firestore,
  userIds: string[]
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();

  await Promise.all(
    userIds.map(async (uid) => {
      const botsSnap = await db
        .collection("users")
        .doc(uid)
        .collection("bots")
        .get();

      let total = 0;
      for (const botDoc of botsSnap.docs) {
        total += botDoc.data().amount ?? 0;
      }
      totals.set(uid, Math.round(total * 100) / 100);
    })
  );

  return totals;
}

export function getDirectReferralStats(
  l1MemberIds: string[],
  botTotalsByUserId: Map<string, number>,
  minInvestment: number
) {
  let qualifiedCount = 0;

  for (const memberId of l1MemberIds) {
    const invested = botTotalsByUserId.get(memberId) ?? 0;
    if (invested >= minInvestment) {
      qualifiedCount += 1;
    }
  }

  return {
    qualifiedCount,
    directReferralCount: l1MemberIds.length,
  };
}

export function getGroupSales(referralStats: ReferralStats): number {
  const stats = normalizeReferralStats(referralStats);
  return Math.round(
    stats.levels.reduce((sum, level) => sum + (level.invested ?? 0), 0) * 100
  ) / 100;
}

export function buildChecklist(
  tier: RankTierConfig,
  metrics: RankMetrics
): RequirementChecklistItem[] {
  const req = tier.requirements;
  const items: RequirementChecklistItem[] = [];

  if (req.personalInvestment != null) {
    items.push({
      id: "personalInvestment",
      label: `Personal Investment ≥ ₱${req.personalInvestment.toLocaleString("en-PH")}`,
      met: metrics.personalInvestment >= req.personalInvestment,
    });
  }

  items.push({
    id: "qualifiedDirectReferrals",
    label: `${req.qualifiedDirectReferrals} Active Direct Referrals`,
    met: metrics.qualifiedDirectReferrals >= req.qualifiedDirectReferrals,
  });

  items.push({
    id: "eachReferralInvested",
    label: `Each Referral Invested ≥ ₱${req.eachReferralMinInvestment.toLocaleString("en-PH")}`,
    met: metrics.qualifiedDirectReferrals >= req.qualifiedDirectReferrals,
  });

  items.push({
    id: "groupSales",
    label: `Group Sales ≥ ₱${req.groupSales.toLocaleString("en-PH")}`,
    met: metrics.groupSales >= req.groupSales,
  });

  return items;
}

export function buildProgressBars(
  tier: RankTierConfig,
  metrics: RankMetrics
): MetricProgress[] {
  const req = tier.requirements;
  const bars: MetricProgress[] = [];

  if (req.personalInvestment != null) {
    bars.push({
      label: "Personal Investment",
      current: metrics.personalInvestment,
      target: req.personalInvestment,
      percent: clampPercent(metrics.personalInvestment, req.personalInvestment),
    });
  }

  bars.push({
    label: "Qualified Direct Referrals",
    current: metrics.qualifiedDirectReferrals,
    target: req.qualifiedDirectReferrals,
    percent: clampPercent(
      metrics.qualifiedDirectReferrals,
      req.qualifiedDirectReferrals
    ),
  });

  bars.push({
    label: "Group Sales",
    current: metrics.groupSales,
    target: req.groupSales,
    percent: clampPercent(metrics.groupSales, req.groupSales),
  });

  return bars;
}

function getDisabledReason(
  checklist: RequirementChecklistItem[],
  currentRank: MemberRank,
  tier: RankTierConfig
): string | null {
  const unmet = checklist.find((item) => !item.met);
  if (unmet) {
    if (unmet.id === "groupSales") return "Group Sales Requirement Missing";
    if (unmet.id === "personalInvestment") {
      return "Personal Investment Requirement Missing";
    }
    if (unmet.id === "qualifiedDirectReferrals") {
      return "Direct Referrals Requirement Missing";
    }
    if (unmet.id === "eachReferralInvested") {
      return "Each Referral Investment Requirement Missing";
    }
    return "Requirements Incomplete";
  }

  const previous = getPreviousRank(tier.id);
  if (
    previous !== "member" &&
    getRankIndex(currentRank) < getRankIndex(previous)
  ) {
    return `Activate ${getRankTier(previous).label} first`;
  }

  return null;
}

export function evaluateRankProgress(
  tier: RankTierConfig,
  metrics: RankMetrics,
  currentRank: MemberRank
): RankProgressCard {
  const checklist = buildChecklist(tier, metrics);
  const progressBars = buildProgressBars(tier, metrics);
  const allMet = checklist.every((item) => item.met);
  const percentComplete =
    checklist.length > 0
      ? Math.round(
          (checklist.filter((item) => item.met).length / checklist.length) *
            100
        )
      : 0;

  const currentIdx = getRankIndex(currentRank);
  const tierIdx = getRankIndex(tier.id);

  let status: RankCardStatus;
  if (currentIdx >= tierIdx) {
    status = "activated";
  } else if (allMet && currentIdx === tierIdx - 1) {
    status = "eligible";
  } else if (currentIdx < tierIdx - 1) {
    status = "locked";
  } else {
    status = "in_progress";
  }

  const disabledReason = getDisabledReason(checklist, currentRank, tier);
  const canActivate = status === "eligible" && disabledReason === null;

  return {
    id: tier.id,
    badge: tier.badge,
    label: tier.label,
    benefits: tier.benefits,
    status,
    percentComplete,
    checklist,
    progressBars,
    canActivate,
    disabledReason: canActivate ? null : disabledReason,
    activateLabel: `Activate ${tier.label} Badge`,
  };
}

export function evaluateAllRankProgress(
  metrics: RankMetrics,
  currentRank: MemberRank,
  tiers: RankTierConfig[] = RANK_TIERS
): RankProgressCard[] {
  return tiers.map((tier) => evaluateRankProgress(tier, metrics, currentRank));
}
