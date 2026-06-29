import type { RankRequirements, RankTierConfig } from "@/lib/ranks/config";
import {
  buildChecklist,
  buildProgressBars,
  type MetricProgress,
  type RankMetrics,
  type RequirementChecklistItem,
} from "@/lib/ranks/progress";

export type RewardType = "tier_500k" | "tier_1m" | "tier_2m";

export const MAX_REWARD_TRACK_SALES = 2_000_000;

/** Shared across all reward tiers — only group sales threshold differs per tier. */
export const REWARD_BASE_REQUIREMENTS = {
  personalInvestment: 10_000,
  qualifiedDirectReferrals: 10,
  eachReferralMinInvestment: 10_000,
} as const;

function rewardRequirementsForThreshold(threshold: number): RankRequirements {
  return {
    ...REWARD_BASE_REQUIREMENTS,
    groupSales: threshold,
  };
}

function rewardRequirementsTier(threshold: number): RankTierConfig {
  return {
    id: "leader",
    badge: "",
    label: "",
    benefits: [],
    requirements: rewardRequirementsForThreshold(threshold),
    leadershipBonusRate: 0,
  };
}

export interface RewardTierConfig {
  id: RewardType;
  name: string;
  shortName: string;
  threshold: number;
  label: string;
  imageSrc: string;
  imageAlt: string;
}

export const REWARD_TIERS: RewardTierConfig[] = [
  {
    id: "tier_500k",
    name: "iPhone 14 Pro Max 256GB",
    shortName: "iPhone 14 Pro Max",
    threshold: 500_000,
    label: "₱500K Milestone",
    imageSrc: "/assets/rewards/iphone-14-pro-max.png",
    imageAlt: "iPhone 14 Pro Max 256GB reward",
  },
  {
    id: "tier_1m",
    name: "iPhone 17 Pro Max 256GB",
    shortName: "iPhone 17 Pro Max",
    threshold: 1_000_000,
    label: "₱1M Milestone",
    imageSrc: "/assets/rewards/iphone-17-pro-max.png",
    imageAlt: "iPhone 17 Pro Max 256GB reward",
  },
  {
    id: "tier_2m",
    name: "Yamaha Aerox or Nmax latest model",
    shortName: "Aerox or Nmax",
    threshold: 2_000_000,
    label: "₱2M Milestone",
    imageSrc: "/assets/rewards/yamaha-scooter.png",
    imageAlt: "Yamaha Aerox or Nmax scooter reward",
  },
];

export const REWARD_TYPE_IDS = REWARD_TIERS.map((t) => t.id);

export type RewardClaimStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "received";

export const REWARD_CLAIM_STATUSES: RewardClaimStatus[] = [
  "pending",
  "processing",
  "shipped",
  "received",
];

export const REWARD_STATUS_LABELS: Record<RewardClaimStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  received: "Received",
};

export const COMMON_COURIERS = [
  "J&T",
  "Ninja Van",
  "LBC",
  "Flash Express",
] as const;

export function getRewardTier(rewardType: RewardType): RewardTierConfig {
  const tier = REWARD_TIERS.find((t) => t.id === rewardType);
  if (!tier) throw new Error(`Unknown reward type: ${rewardType}`);
  return tier;
}

export function isRewardType(value: unknown): value is RewardType {
  return (
    typeof value === "string" &&
    REWARD_TYPE_IDS.includes(value as RewardType)
  );
}

export function isRewardClaimStatus(
  value: unknown
): value is RewardClaimStatus {
  return (
    typeof value === "string" &&
    REWARD_CLAIM_STATUSES.includes(value as RewardClaimStatus)
  );
}

export function formatRewardValue(threshold: number): string {
  if (threshold >= 1_000_000) {
    return `₱${(threshold / 1_000_000).toFixed(0)}M group sales`;
  }
  return `₱${(threshold / 1_000).toFixed(0)}K group sales`;
}

export function formatGroupSalesThreshold(threshold: number): string {
  return `${threshold.toLocaleString("en-PH")} Group Sales`;
}

/** Sum of claimed tier thresholds — deducted from lifetime sales for reward progress only. */
export function getClaimedRewardSalesOffset(claimedTiers: string[]): number {
  return REWARD_TIERS.filter((tier) => claimedTiers.includes(tier.id)).reduce(
    (sum, tier) => sum + tier.threshold,
    0
  );
}

/** Reward counter after deducting claimed milestones; ranks use lifetime totals instead. */
export function getEffectiveRewardGroupSales(
  lifetimeGroupSales: number,
  claimedTiers: string[]
): number {
  return Math.max(
    0,
    lifetimeGroupSales - getClaimedRewardSalesOffset(claimedTiers)
  );
}

export function withRewardGroupSales(
  metrics: RankMetrics,
  claimedTiers: string[]
): RankMetrics {
  return {
    ...metrics,
    groupSales: getEffectiveRewardGroupSales(metrics.groupSales, claimedTiers),
  };
}

/** Group sales progress toward a reward tier threshold (not checklist-based). */
export function getRewardGroupSalesPercent(
  groupSales: number,
  threshold: number
): number {
  if (threshold <= 0) return 100;
  const raw = Math.min(100, (groupSales / threshold) * 100);
  if (raw > 0 && raw < 1) {
    return Math.round(raw * 10) / 10;
  }
  return Math.round(raw);
}

export function formatRewardGroupSalesPercent(
  groupSales: number,
  threshold: number
): string {
  const percent = getRewardGroupSalesPercent(groupSales, threshold);
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1)}%`;
}

export type RewardTierState = "locked" | "eligible" | "claimed";

export interface RewardTierProgress {
  id: RewardType;
  name: string;
  shortName: string;
  label: string;
  threshold: number;
  imageSrc: string;
  imageAlt: string;
  state: RewardTierState;
  percentComplete: number;
  trackPositionPercent: number;
  checklist: RequirementChecklistItem[];
  progressBars: MetricProgress[];
  disabledReason: string | null;
}

function getRewardDisabledReason(
  checklist: RequirementChecklistItem[]
): string | null {
  const unmet = checklist.find((item) => !item.met);
  if (!unmet) return null;
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

export function getRewardTierProgress(
  metrics: RankMetrics,
  claimedTiers: string[]
): RewardTierProgress[] {
  const claimed = new Set(claimedTiers);
  const rewardMetrics = withRewardGroupSales(metrics, claimedTiers);

  return REWARD_TIERS.map((rewardTier) => {
    const reqTier = rewardRequirementsTier(rewardTier.threshold);
    const checklist = buildChecklist(reqTier, rewardMetrics);
    const progressBars = buildProgressBars(reqTier, rewardMetrics);
    const allMet = checklist.every((item) => item.met);

    let state: RewardTierState = "locked";
    if (claimed.has(rewardTier.id)) {
      state = "claimed";
    } else if (allMet) {
      state = "eligible";
    }

    const percentComplete = getRewardGroupSalesPercent(
      rewardMetrics.groupSales,
      rewardTier.threshold
    );

    return {
      id: rewardTier.id,
      name: rewardTier.name,
      shortName: rewardTier.shortName,
      label: rewardTier.label,
      threshold: rewardTier.threshold,
      imageSrc: rewardTier.imageSrc,
      imageAlt: rewardTier.imageAlt,
      state,
      percentComplete,
      trackPositionPercent:
        (rewardTier.threshold / MAX_REWARD_TRACK_SALES) * 100,
      checklist,
      progressBars,
      disabledReason: state === "eligible" ? null : getRewardDisabledReason(checklist),
    };
  });
}

/** @deprecated Use getRewardTierProgress with full metrics */
export function getEligibleTiers(
  groupSales: number,
  claimedTiers: string[]
): RewardTierProgress[] {
  const metrics: RankMetrics = {
    personalInvestment: 0,
    qualifiedDirectReferrals: 0,
    directReferralCount: 0,
    groupSales,
  };
  return getRewardTierProgress(metrics, claimedTiers);
}

export function isRewardTierEligible(
  rewardType: RewardType,
  metrics: RankMetrics,
  claimedTiers: string[]
): boolean {
  if (claimedTiers.includes(rewardType)) return false;
  const rewardTier = getRewardTier(rewardType);
  const reqTier = rewardRequirementsTier(rewardTier.threshold);
  const rewardMetrics = withRewardGroupSales(metrics, claimedTiers);
  const checklist = buildChecklist(reqTier, rewardMetrics);
  return checklist.every((item) => item.met);
}

export function formatDeliveryAddress(address: {
  street: string;
  barangay: string;
  city: string;
  postalCode: string;
}): string {
  return [
    address.street,
    address.barangay,
    address.city,
    address.postalCode,
  ]
    .filter(Boolean)
    .join("\n");
}
