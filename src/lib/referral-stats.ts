import { REFERRAL_RATES, REFERRAL_LEVEL_LABELS } from "@/lib/finance";

export interface ReferralLevelStats {
  members: number;
  invested: number;
  earned: number;
}

export interface ReferralStats {
  totalEarned: number;
  levels: ReferralLevelStats[];
}

export function createEmptyReferralStats(): ReferralStats {
  return {
    totalEarned: 0,
    levels: Array.from({ length: REFERRAL_RATES.length }, () => ({
      members: 0,
      invested: 0,
      earned: 0,
    })),
  };
}

/** Normalize legacy `level1` / `level2to5` stats into per-level structure. */
export function normalizeReferralStats(
  raw?: Partial<ReferralStats> & { level1?: number; level2to5?: number }
): ReferralStats {
  if (raw?.levels?.length === REFERRAL_RATES.length) {
    return {
      totalEarned: raw.totalEarned ?? 0,
      levels: raw.levels.map((l) => ({
        members: l?.members ?? 0,
        invested: l?.invested ?? 0,
        earned: l?.earned ?? 0,
      })),
    };
  }

  const empty = createEmptyReferralStats();
  empty.totalEarned = raw?.totalEarned ?? 0;
  // Legacy level1 counted bot subs, not members — cannot recover invested.
  return empty;
}

export function getReferralLevelSummaries(stats: ReferralStats) {
  return REFERRAL_RATES.map((rate, i) => ({
    level: i + 1,
    label: REFERRAL_LEVEL_LABELS[i],
    percent: Math.round(rate * 100),
    members: stats.levels[i]?.members ?? 0,
    invested: stats.levels[i]?.invested ?? 0,
    earned: stats.levels[i]?.earned ?? 0,
  }));
}

export function getReferralTotals(stats: ReferralStats) {
  const summaries = getReferralLevelSummaries(stats);
  return {
    directMembers: summaries[0]?.members ?? 0,
    totalMembers: summaries.reduce((s, l) => s + l.members, 0),
    totalInvested: summaries.reduce((s, l) => s + l.invested, 0),
    totalEarned: stats.totalEarned,
  };
}
