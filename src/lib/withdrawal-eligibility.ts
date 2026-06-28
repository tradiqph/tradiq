import type { ReferralStats } from "@/lib/referral-stats";

export const WITHDRAWAL_DEPOSIT_REQUIRED_MESSAGE =
  "Make your first deposit before requesting a withdrawal.";

export const WITHDRAWAL_BOT_REQUIRED_MESSAGE =
  "Subscribe to at least one bot before requesting a withdrawal.";

export const WITHDRAWAL_DEPOSIT_AND_BOT_REQUIRED_MESSAGE =
  "Make your first deposit and subscribe to at least one bot before requesting a withdrawal.";

export interface WithdrawalEligibilityProfile {
  totalDeposited?: number;
  referralStats?: Partial<ReferralStats> & {
    level1?: number;
    level2to5?: number;
  };
}

export interface WithdrawalEligibilityContext {
  hasBotInvestment: boolean;
}

export interface WithdrawalEligibilityStatus {
  allowed: boolean;
  missingDeposit: boolean;
  missingBot: boolean;
  message: string | null;
}

export function getWithdrawalEligibilityStatus(
  profile: WithdrawalEligibilityProfile,
  context: WithdrawalEligibilityContext
): WithdrawalEligibilityStatus {
  const hasDeposit = (profile.totalDeposited ?? 0) > 0;
  const hasBotInvestment = context.hasBotInvestment;

  if (hasDeposit && hasBotInvestment) {
    return {
      allowed: true,
      missingDeposit: false,
      missingBot: false,
      message: null,
    };
  }

  const missingDeposit = !hasDeposit;
  const missingBot = !hasBotInvestment;

  let message: string;
  if (missingDeposit && missingBot) {
    message = WITHDRAWAL_DEPOSIT_AND_BOT_REQUIRED_MESSAGE;
  } else if (missingDeposit) {
    message = WITHDRAWAL_DEPOSIT_REQUIRED_MESSAGE;
  } else {
    message = WITHDRAWAL_BOT_REQUIRED_MESSAGE;
  }

  return {
    allowed: false,
    missingDeposit,
    missingBot,
    message,
  };
}

export function getWithdrawalEligibilityBlocker(
  profile: WithdrawalEligibilityProfile,
  context: WithdrawalEligibilityContext
): string | null {
  return getWithdrawalEligibilityStatus(profile, context).message;
}

/** @deprecated Use getWithdrawalEligibilityBlocker with bot context. */
export function getWithdrawalDepositGateMessage(
  profile: WithdrawalEligibilityProfile,
  context: WithdrawalEligibilityContext
): string | null {
  return getWithdrawalEligibilityBlocker(profile, context);
}
