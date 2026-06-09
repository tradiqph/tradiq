export const DAILY_BOT_RATE = 0.03;
export const REFERRAL_RATES = [0.15, 0.03, 0.02, 0.01, 0.01] as const;
export const REFERRAL_SUBSCRIPTION_TIERS = [500, 1000, 5000] as const;
export const DEPOSIT_PRESETS = [500, 1000, 3000, 5000, 10000] as const;
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
