import { BOT_TERM_DAYS, DAILY_BOT_RATE, formatPeso } from "@/lib/finance";

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

function signedAmount(amount: number): string {
  return `+${formatPeso(amount)}`;
}

export function dailyEarningPushMessage(amount: number): PushMessage {
  return {
    title: "Daily earnings credited",
    body: `${signedAmount(amount)} from your bot subscription was added to your Wallet Balance.`,
    url: "/history",
    tag: "daily-earning",
  };
}

export function finalEarningPushMessage(amount: number): PushMessage {
  return {
    title: "Final earnings credited",
    body: `${signedAmount(amount)} from your bot subscription was added to your Wallet Balance.`,
    url: "/history",
    tag: "final-earning",
  };
}

export function principalReturnPushMessage(amount: number): PushMessage {
  return {
    title: "Principal returned",
    body: `${signedAmount(amount)} principal from your completed bot subscription was added to your Wallet Balance.`,
    url: "/history",
    tag: "principal-return",
  };
}

export function referralCommissionPushMessage(
  amount: number,
  fromName: string
): PushMessage {
  const possessive =
    fromName === "a network member" ? "a network member's" : `${fromName}'s`;
  return {
    title: "Referral commission credited",
    body: `${signedAmount(amount)} from ${possessive} bot subscription was added to your Wallet Balance.`,
    url: "/referral",
    tag: "referral-commission",
  };
}

export function supportReplyPushMessage(preview: string): PushMessage {
  return {
    title: "Support replied",
    body: preview.slice(0, 180) || "Tap to read the response.",
    url: "/account?support=1",
    tag: "support-reply",
  };
}

export function resolveReferralPushName(
  displayName?: string | null,
  email?: string | null
): string {
  if (displayName?.trim()) return displayName.trim();
  if (email?.trim()) return email.trim();
  return "a network member";
}
