export type MemberRank = "member" | "leader" | "director" | "ambassador";

export type PromotableRank = Exclude<MemberRank, "member">;

export interface RankRequirements {
  personalInvestment?: number;
  qualifiedDirectReferrals: number;
  eachReferralMinInvestment: number;
  groupSales: number;
}

export interface RankTierConfig {
  id: PromotableRank;
  badge: string;
  label: string;
  benefits: string[];
  requirements: RankRequirements;
  leadershipBonusRate: number;
}

export const MEMBER_BADGE = "⭐ Member";

export const RANK_ORDER: MemberRank[] = [
  "member",
  "leader",
  "director",
  "ambassador",
];

export const RANK_TIERS: RankTierConfig[] = [
  {
    id: "leader",
    badge: "🥉 Leader",
    label: "Leader",
    benefits: [
      "7% Direct Referral",
      "+ 1% Daily Leadership Bonus on Level 1 Direct Referral Bots",
    ],
    requirements: {
      personalInvestment: 10_000,
      qualifiedDirectReferrals: 10,
      eachReferralMinInvestment: 10_000,
      groupSales: 500_000,
    },
    leadershipBonusRate: 0.01,
  },
  {
    id: "director",
    badge: "🥈 Director",
    label: "Director",
    benefits: [
      "7% Direct Referral",
      "+ 1.2% Daily Leadership Bonus on Level 1 Direct Referral Bots",
    ],
    requirements: {
      qualifiedDirectReferrals: 20,
      eachReferralMinInvestment: 10_000,
      groupSales: 1_000_000,
    },
    leadershipBonusRate: 0.012,
  },
  {
    id: "ambassador",
    badge: "🥇 Ambassador",
    label: "Ambassador",
    benefits: [
      "7% Direct Referral",
      "+ 1.5% Daily Leadership Bonus on Level 1 Direct Referral Bots",
    ],
    requirements: {
      qualifiedDirectReferrals: 30,
      eachReferralMinInvestment: 10_000,
      groupSales: 2_000_000,
    },
    leadershipBonusRate: 0.015,
  },
];

export function getRankTier(rank: PromotableRank): RankTierConfig {
  const tier = RANK_TIERS.find((t) => t.id === rank);
  if (!tier) throw new Error(`Unknown rank: ${rank}`);
  return tier;
}

export function getRankIndex(rank: MemberRank): number {
  return RANK_ORDER.indexOf(rank);
}

export function getLeadershipBonusRate(rank: MemberRank): number {
  if (rank === "member") return 0;
  return getRankTier(rank).leadershipBonusRate;
}

export function getPreviousRank(rank: PromotableRank): MemberRank {
  const idx = getRankIndex(rank);
  return RANK_ORDER[idx - 1] ?? "member";
}

export function normalizeMemberRank(value: unknown): MemberRank {
  if (
    value === "leader" ||
    value === "director" ||
    value === "ambassador"
  ) {
    return value;
  }
  return "member";
}
