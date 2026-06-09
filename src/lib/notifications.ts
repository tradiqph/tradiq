import { format, formatDistanceToNow } from "date-fns";
import { Transaction, UserProfile } from "@/types";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  type: "security" | "transaction" | "earning" | "system";
  href?: string;
}

export function buildAppNotifications(
  profile: UserProfile | null,
  transactions: (Transaction & { id: string })[]
): AppNotification[] {
  const items: AppNotification[] = [];

  if (!profile) return items;

  if (!profile.securityPinHash) {
    items.push({
      id: "security-pin",
      title: "Set your security PIN",
      body: "Protect withdrawals by adding a 4-digit PIN in your account settings.",
      time: "Action needed",
      type: "security",
      href: "/account",
    });
  }

  if (profile.totalEarnings > 0) {
    items.push({
      id: "earnings-summary",
      title: "Bot earnings credited",
      body: `Your total earnings have reached ₱${profile.totalEarnings.toLocaleString()}.`,
      time: "Today",
      type: "earning",
      href: "/bot",
    });
  }

  if (profile.referralStats.totalEarned > 0) {
    items.push({
      id: "referral-earned",
      title: "Referral bonus received",
      body: `You've earned ₱${profile.referralStats.totalEarned.toLocaleString()} from referrals.`,
      time: "Recent",
      type: "earning",
      href: "/referral",
    });
  }

  for (const tx of transactions.slice(0, 8)) {
    const date = tx.createdAt?.toDate?.();
    const time = date
      ? formatDistanceToNow(date, { addSuffix: true })
      : "Recently";

    if (tx.status === "pending" && tx.type === "withdrawal") {
      items.push({
        id: `tx-${tx.id}`,
        title: "Withdrawal pending review",
        body: `Your ₱${tx.amount.toLocaleString()} cashout is awaiting approval.`,
        time,
        type: "transaction",
        href: "/history",
      });
      continue;
    }

    if (tx.status === "pending" && tx.type === "deposit") {
      items.push({
        id: `tx-${tx.id}`,
        title: "Deposit awaiting payment",
        body: `Complete your ₱${tx.amount.toLocaleString()} QR Ph deposit to fund your wallet.`,
        time,
        type: "transaction",
        href: "/history",
      });
      continue;
    }

    const title =
      tx.title ??
      ({
        deposit: "Deposit recorded",
        bot_subscribe: "Bot subscription",
        earning: "Daily bot earning",
        referral: "Referral commission",
        withdrawal: "Withdrawal update",
      }[tx.type] ?? "Account update");

    const body =
      tx.subtitle ??
      (date ? format(date, "MMM d, yyyy · h:mm a") : `₱${tx.amount.toLocaleString()}`);

    items.push({
      id: `tx-${tx.id}`,
      title,
      body,
      time,
      type: tx.type === "earning" || tx.type === "referral" ? "earning" : "transaction",
      href: "/history",
    });
  }

  if (items.length === 0) {
    items.push({
      id: "welcome",
      title: "Welcome to TradIQ",
      body: "Fund your wallet, subscribe to a signal bot, and start earning up to 3% daily.",
      time: "Just now",
      type: "system",
      href: "/bot",
    });
  }

  return items;
}

