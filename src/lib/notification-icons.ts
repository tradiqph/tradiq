import {
  Bot,
  Banknote,
  Coins,
  Gift,
  Headphones,
  Shield,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { AppNotificationKind } from "@/lib/notifications";

export const notificationKindIcon: Record<AppNotificationKind, LucideIcon> = {
  daily_earning: Coins,
  final_earning: Coins,
  principal_return: Banknote,
  bot_activated: Bot,
  referral_commission: Gift,
  withdrawal_pending: Wallet,
  deposit_pending: Wallet,
  security: Shield,
  support: Headphones,
  system: Sparkles,
};

export const notificationKindIconStyle: Record<AppNotificationKind, string> = {
  daily_earning: "bg-amber-500/15 text-amber-400",
  final_earning: "bg-amber-500/15 text-amber-400",
  principal_return: "bg-amber-500/15 text-amber-400",
  bot_activated: "bg-zinc-700/80 text-zinc-300",
  referral_commission: "bg-emerald-500/15 text-emerald-400",
  withdrawal_pending: "bg-blue-500/10 text-blue-300",
  deposit_pending: "bg-blue-500/10 text-blue-300",
  security: "bg-amber-500/15 text-amber-400",
  support: "bg-amber-500/15 text-amber-400",
  system: "bg-violet-500/20 text-violet-300",
};

export function getNotificationKindIcon(kind: AppNotificationKind): LucideIcon {
  return notificationKindIcon[kind] ?? Sparkles;
}

export function getNotificationKindIconStyle(kind: AppNotificationKind): string {
  return notificationKindIconStyle[kind];
}

const EARNING_DETAIL_KINDS = new Set<AppNotificationKind>([
  "daily_earning",
  "final_earning",
  "principal_return",
  "referral_commission",
]);

const AMBER_DETAIL_KINDS = new Set<AppNotificationKind>([
  ...EARNING_DETAIL_KINDS,
  "support",
  "security",
]);

export function getNotificationDetailModalStyle(kind: AppNotificationKind): {
  border: string;
  closeButton: string;
} {
  if (AMBER_DETAIL_KINDS.has(kind)) {
    return {
      border: "border-amber-500/30",
      closeButton: "bg-amber-600 hover:bg-amber-500",
    };
  }

  return {
    border: "border-violet-500/30",
    closeButton: "bg-violet-600 hover:bg-violet-500",
  };
}

export function getNotificationSlideInStyle(kind: AppNotificationKind): string {
  if (EARNING_DETAIL_KINDS.has(kind)) {
    return "border-amber-500/50 shadow-lg shadow-amber-500/10";
  }

  return "border-violet-500/50 shadow-lg shadow-violet-500/10";
}
