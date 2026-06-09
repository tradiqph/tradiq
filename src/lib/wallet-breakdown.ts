import { normalizeReferralStats } from "@/lib/referral-stats";
import { UserProfile } from "@/types";

export interface WalletBreakdown {
  walletBalance: number;
  investmentEarnings: number;
  referralEarnings: number;
  totalEarnings: number;
  investmentPercent: number;
  referralPercent: number;
  totalDeposited: number;
  totalWithdrawn: number;
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function computeWalletBreakdown(profile: UserProfile): WalletBreakdown {
  const investmentEarnings = profile.totalEarnings ?? 0;
  const referralEarnings =
    normalizeReferralStats(profile.referralStats).totalEarned;
  const totalEarnings = investmentEarnings + referralEarnings;

  return {
    walletBalance: profile.walletBalance ?? 0,
    investmentEarnings,
    referralEarnings,
    totalEarnings,
    investmentPercent: pct(investmentEarnings, totalEarnings),
    referralPercent: pct(referralEarnings, totalEarnings),
    totalDeposited: profile.totalDeposited ?? 0,
    totalWithdrawn: profile.totalWithdrawn ?? 0,
  };
}
