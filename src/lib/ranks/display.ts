import {
  getRankTier,
  MEMBER_BADGE,
  normalizeMemberRank,
  type MemberRank,
  type PromotableRank,
} from "@/lib/ranks/config";

export function getRankBadge(rank: unknown): string {
  const normalized = normalizeMemberRank(rank);
  if (normalized === "member") return MEMBER_BADGE;
  return getRankTier(normalized).badge;
}

export function getRankLabel(rank: unknown): string {
  const normalized = normalizeMemberRank(rank);
  if (normalized === "member") return "Member";
  return getRankTier(normalized).label;
}

export function getActivateButtonLabel(rank: PromotableRank): string {
  return `Activate ${getRankTier(rank).label} Badge`;
}

export type RankCardStatus =
  | "locked"
  | "in_progress"
  | "eligible"
  | "activated";

export function formatRankStatus(status: RankCardStatus): string {
  switch (status) {
    case "eligible":
      return "Eligible for Promotion";
    case "activated":
      return "Activated";
    case "locked":
    case "in_progress":
    default:
      return "";
  }
}

export function formatPercentComplete(percent: number): string {
  return `${Math.round(percent)}% Complete`;
}
