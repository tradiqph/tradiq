export const ACTIVE_PROMO_ID = "direct-deposit-2pct-2026";

export const ACTIVE_PROMO_IMAGE =
  "/assets/announcements/active-promo/direct-deposit-2pct-genz-v2.png";

export const ACTIVE_PROMO = {
  title: "Extra 2% Deposit Bonus",
  headline: "2% bonus on direct deposits",
  minAmount: 50_000,
  minAmountLabel: "₱50K and above",
  bonusRate: 0.02,
  paymongoAccountName: "TradIQPH",
  paymongoAccountNumber: "963617273120",
  perks: [
    "Faster transaction processing",
    "Faster approval for referral payout",
  ],
  proofNote:
    "After sending, submit your proof of transaction (screenshot or receipt) via Support so we can credit your account.",
} as const;

export function isActivePromoAvailable(): boolean {
  return true;
}
