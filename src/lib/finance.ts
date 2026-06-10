export const DAILY_BOT_RATE = 0.03;

/**
 * One-time commission on bot subscription amount only.
 * Uplines do NOT share the investor's daily bot earnings or principal returns.
 */
export const REFERRAL_RATES = [0.15, 0.03, 0.02, 0.01, 0.01] as const;
export const REFERRAL_SUBSCRIPTION_TIERS = [500, 1000, 5000] as const;
export const DEPOSIT_PRESETS = [30, 500, 1000, 3000, 5000, 10000] as const;
export const BOT_PRESETS = [500, 1000, 3000, 5000, 10000] as const;

export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function generateReferralCode(displayName: string): string {
  const namePart = (displayName || "USER")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 6)
    .toUpperCase();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TRD-${namePart || "USER"}-${rand}`;
}

export function calculateReferralCommissions(amount: number): number[] {
  return REFERRAL_RATES.map((rate) => Math.round(amount * rate * 100) / 100);
}

export const REFERRAL_LEVEL_LABELS = [
  "Direct Referral",
  "Level 2 Referral",
  "Level 3 Referral",
  "Level 4 Referral",
  "Level 5 Referral",
] as const;

export function getReferralRewardExamples() {
  return REFERRAL_RATES.map((rate, i) => ({
    level: i + 1,
    label: REFERRAL_LEVEL_LABELS[i],
    percent: Math.round(rate * 100),
    examples: REFERRAL_SUBSCRIPTION_TIERS.map((sub) => ({
      sub,
      reward: Math.round(sub * rate),
    })),
  }));
}

export function calculateDailyEarning(botAmount: number): number {
  return Math.round(botAmount * DAILY_BOT_RATE * 100) / 100;
}

export const DEPOSIT_MIN_AMOUNT = 30;
export const DEPOSIT_MAX_AMOUNT = 10000;
export const BOT_MIN_AMOUNT = 1;
export const BOT_MAX_AMOUNT = 10000;
export const WITHDRAWAL_MIN_AMOUNT = 30;
export const WITHDRAWAL_MAX_AMOUNT = 10000;
export const WITHDRAWAL_PROCESSING_FEE_RATE = 0.04;

export function validateDepositAmount(amount: number): string | null {
  if (!amount || amount <= 0) return "Enter a valid amount";
  if (amount < DEPOSIT_MIN_AMOUNT) {
    return `Minimum deposit is ${formatPeso(DEPOSIT_MIN_AMOUNT)}`;
  }
  if (amount > DEPOSIT_MAX_AMOUNT) {
    return `Maximum deposit is ${formatPeso(DEPOSIT_MAX_AMOUNT)}`;
  }
  return null;
}

export function validateBotSubscribeAmount(amount: number): string | null {
  if (!amount || amount <= 0) return "Enter a valid amount";
  if (amount > BOT_MAX_AMOUNT) {
    return `Maximum subscription is ${formatPeso(BOT_MAX_AMOUNT)} per bot`;
  }
  return null;
}

export function validateWithdrawalAmount(amount: number): string | null {
  if (!amount || amount <= 0) return "Enter a valid amount";
  if (amount < WITHDRAWAL_MIN_AMOUNT) {
    return `Minimum withdrawal is ${formatPeso(WITHDRAWAL_MIN_AMOUNT)}`;
  }
  if (amount > WITHDRAWAL_MAX_AMOUNT) {
    return `Maximum withdrawal is ${formatPeso(WITHDRAWAL_MAX_AMOUNT)} per request`;
  }
  return null;
}

export function calculateWithdrawalBreakdown(amount: number) {
  const processingFee =
    Math.round(amount * WITHDRAWAL_PROCESSING_FEE_RATE * 100) / 100;
  const netPayout = Math.round((amount - processingFee) * 100) / 100;

  return {
    amount,
    processingFee,
    netPayout,
    feePercent: Math.round(WITHDRAWAL_PROCESSING_FEE_RATE * 100),
  };
}

export const BOT_TERM_DAYS = 30;

export function calculateBotTermProjection(amount: number) {
  const dailyEarning = calculateDailyEarning(amount);
  const totalInterest =
    Math.round(dailyEarning * BOT_TERM_DAYS * 100) / 100;
  const totalReturn = Math.round((amount + totalInterest) * 100) / 100;
  const returnPercent = Math.round(DAILY_BOT_RATE * BOT_TERM_DAYS * 100);

  return {
    dailyEarning,
    totalInterest,
    totalReturn,
    principal: amount,
    termDays: BOT_TERM_DAYS,
    returnPercent,
  };
}
