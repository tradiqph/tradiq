import type { RankMetrics } from "@/lib/ranks/progress";

export const QA_TEST_ACCOUNT_EMAIL = "qa@tradiq.biz";
export const QA_OVERRIDE_TTL_MS = 24 * 60 * 60 * 1000;

export const LEADER_QA_METRICS: RankMetrics = {
  personalInvestment: 20_000,
  qualifiedDirectReferrals: 10,
  eachReferralMet: true,
  directReferralCount: 10,
  groupSales: 500_000,
};

export type QaEligibilityTarget = "leader_and_tier_500k";

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof (value as { seconds: number }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString();
  }
  return null;
}

export function isAllowedQaTestAccount(email: string | undefined): boolean {
  return email?.trim().toLowerCase() === QA_TEST_ACCOUNT_EMAIL;
}

export function isQaOverrideActive(userData: {
  isTestAccount?: boolean;
  email?: string;
  qaEligibilityOverride?: {
    enabled?: boolean;
    expiresAt?: unknown;
  };
}): boolean {
  if (!userData.isTestAccount) return false;
  if (!isAllowedQaTestAccount(userData.email)) return false;

  const override = userData.qaEligibilityOverride;
  if (!override?.enabled) return false;

  const expiresAt = toIsoString(override.expiresAt);
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return false;
  }

  return true;
}
