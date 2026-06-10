import { formatPeso } from "@/lib/finance";
import { normalizeReferralStats } from "@/lib/referral-stats";
import type { ReferralStats } from "@/lib/referral-stats";

export const WITHDRAWAL_DEPOSIT_REQUIRED_MESSAGE =
  "Make your first deposit before requesting a withdrawal. Referral earnings stay in your wallet until you deposit.";

export interface WithdrawalDepositGateProfile {
  totalDeposited?: number;
  referralStats?: Partial<ReferralStats> & {
    level1?: number;
    level2to5?: number;
  };
}

export function requiresDepositBeforeWithdrawal(
  profile: WithdrawalDepositGateProfile
): boolean {
  const totalDeposited = profile.totalDeposited ?? 0;
  if (totalDeposited > 0) return false;

  const referralEarned = normalizeReferralStats(profile.referralStats).totalEarned;
  return referralEarned > 0;
}

export function getWithdrawalDepositGateMessage(
  profile: WithdrawalDepositGateProfile
): string | null {
  if (!requiresDepositBeforeWithdrawal(profile)) return null;

  const referralEarned = normalizeReferralStats(profile.referralStats).totalEarned;
  return `You've earned ${formatPeso(referralEarned)} from referrals. ${WITHDRAWAL_DEPOSIT_REQUIRED_MESSAGE}`;
}
