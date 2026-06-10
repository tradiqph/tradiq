import {
  REFERRAL_LEVEL_LABELS,
  REFERRAL_RATES,
  calculateReferralCommissions,
} from "@/lib/finance";

export type CommissionRecipient = "upline" | "admin";

export interface LevelCommissionBreakdown {
  level: number;
  label: string;
  amount: number;
  recipient: CommissionRecipient;
  recipientUserId?: string | null;
  recipientDisplayName?: string | null;
  recipientEmail?: string | null;
}

export function buildSubscriptionCommissionBreakdown(
  amount: number,
  subscriberReferredBy: string | null,
  referredByMap: Map<string, string | null>,
  userLookup: Map<string, { email: string; displayName: string }>
) {
  const rates = calculateReferralCommissions(amount);
  const levelCommissions: LevelCommissionBreakdown[] = [];

  let uplineUid: string | null = subscriberReferredBy;

  for (let level = 0; level < REFERRAL_RATES.length; level++) {
    const commissionAmount = rates[level];
    if (commissionAmount <= 0) continue;

    if (uplineUid) {
      const user = userLookup.get(uplineUid);
      levelCommissions.push({
        level: level + 1,
        label: REFERRAL_LEVEL_LABELS[level],
        amount: commissionAmount,
        recipient: "upline",
        recipientUserId: uplineUid,
        recipientDisplayName: user?.displayName ?? null,
        recipientEmail: user?.email ?? null,
      });
      uplineUid = referredByMap.get(uplineUid) ?? null;
    } else {
      levelCommissions.push({
        level: level + 1,
        label: "Admin Commission",
        amount: commissionAmount,
        recipient: "admin",
      });
    }
  }

  const subscriptionCommissionTotal = Math.round(
    levelCommissions
      .filter((entry) => entry.recipient === "upline")
      .reduce((sum, entry) => sum + entry.amount, 0) * 100
  ) / 100;

  const adminCommissionTotal = Math.round(
    levelCommissions
      .filter((entry) => entry.recipient === "admin")
      .reduce((sum, entry) => sum + entry.amount, 0) * 100
  ) / 100;

  const directReferralCommission =
    levelCommissions.find(
      (entry) => entry.level === 1 && entry.recipient === "upline"
    )?.amount ?? 0;

  return {
    levelCommissions,
    subscriptionCommissionTotal,
    adminCommissionTotal,
    directReferralCommission,
  };
}
