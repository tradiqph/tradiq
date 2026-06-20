import { format, formatDistanceToNow } from "date-fns";
import {
  BOT_TERM_DAYS,
  DAILY_BOT_RATE,
  formatPeso,
} from "@/lib/finance";
import { getReferralSourceName } from "@/lib/transactions";
import { userHasSecurityPin } from "@/lib/security/pin";
import type { SupportNotificationItem, SupportUnreadItem } from "@/lib/support";
import { Transaction, UserProfile } from "@/types";

export type AppNotificationKind =
  | "daily_earning"
  | "final_earning"
  | "principal_return"
  | "bot_activated"
  | "referral_commission"
  | "withdrawal_pending"
  | "deposit_pending"
  | "security"
  | "support"
  | "system";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  kind: AppNotificationKind;
  type: "security" | "transaction" | "earning" | "system" | "support";
  amount?: number;
  createdAt?: Date;
  unread?: boolean;
  href?: string;
}

function formatNotificationTime(date: Date | null): string {
  if (!date) return "RECENTLY";
  return formatDistanceToNow(date, { addSuffix: true }).toUpperCase();
}

function formatNotificationFullDate(date: Date | null): string {
  if (!date) return "";
  return format(date, "MMM d, yyyy, h:mm a").toUpperCase();
}

function formatSignedAmount(amount: number): string {
  return `+${formatPeso(amount)}`;
}

function referralPossessive(name: string): string {
  if (name === "Network member") return "a network member's";
  if (/s$/i.test(name)) return `${name}'`;
  return `${name}'s`;
}

function getEarningKind(
  tx: Pick<Transaction, "type" | "title">
): AppNotificationKind | null {
  const title = (tx.title ?? "").toLowerCase();
  if (title.includes("principal")) return "principal_return";
  if (title.includes("final")) return "final_earning";
  if (title.includes("daily") || tx.type === "earning") return "daily_earning";
  return null;
}

function buildEarningNotification(
  tx: Transaction & { id: string },
  kind: AppNotificationKind
): AppNotification | null {
  if (tx.type !== "earning" || tx.status !== "paid") return null;

  const date = tx.createdAt?.toDate?.() ?? null;
  const signed = formatSignedAmount(tx.amount);

  if (kind === "principal_return") {
    return {
      id: `tx-${tx.id}`,
      kind,
      type: "earning",
      title: "Principal returned",
      body: `${signed} principal from your completed bot subscription was added to your Wallet Balance.`,
      time: formatNotificationTime(date),
      amount: tx.amount,
      createdAt: date ?? undefined,
      href: "/history",
    };
  }

  const title =
    kind === "final_earning"
      ? "Final earnings credited"
      : "Daily earnings credited";

  return {
    id: `tx-${tx.id}`,
    kind,
    type: "earning",
    title,
    body: `${signed} from your bot subscription was added to your Wallet Balance.`,
    time: formatNotificationTime(date),
    amount: tx.amount,
    createdAt: date ?? undefined,
    href: "/history",
  };
}

export function buildTransactionNotifications(
  transactions: (Transaction & { id: string })[],
  referralSourceNames?: Record<string, string>
): AppNotification[] {
  const items: AppNotification[] = [];

  for (const tx of transactions) {
    const date = tx.createdAt?.toDate?.() ?? null;

    if (tx.status === "pending" && tx.type === "withdrawal") {
      items.push({
        id: `tx-${tx.id}`,
        kind: "withdrawal_pending",
        type: "transaction",
        title: "Withdrawal pending review",
        body: `Your ${formatPeso(tx.amount)} cashout is awaiting approval.`,
        time: formatNotificationTime(date),
        amount: tx.amount,
        createdAt: date ?? undefined,
        href: "/history",
      });
      continue;
    }

    if (tx.status === "pending" && tx.type === "deposit") {
      items.push({
        id: `tx-${tx.id}`,
        kind: "deposit_pending",
        type: "transaction",
        title: "Deposit awaiting payment",
        body: `Complete your ${formatPeso(tx.amount)} QR Ph deposit to fund your wallet.`,
        time: formatNotificationTime(date),
        amount: tx.amount,
        createdAt: date ?? undefined,
        href: "/history",
      });
      continue;
    }

    if (tx.type === "bot_subscribe" && tx.status === "paid") {
      const dailyPercent = Math.round(DAILY_BOT_RATE * 100);
      items.push({
        id: `tx-${tx.id}`,
        kind: "bot_activated",
        type: "transaction",
        title: "Copy Trading Bot activated",
        body: `Your ${formatPeso(tx.amount)} subscription is now active. Earning ${dailyPercent}% daily for ${BOT_TERM_DAYS} days.`,
        time: formatNotificationTime(date),
        amount: tx.amount,
        createdAt: date ?? undefined,
        href: "/bot",
      });
      continue;
    }

    if (tx.type === "referral" && tx.status === "paid") {
      const rawSource = getReferralSourceName(tx, referralSourceNames);
      const source =
        !rawSource || rawSource === "Network member"
          ? "a network member"
          : rawSource;
      const possessive =
        source === "a network member"
          ? "a network member's"
          : referralPossessive(source);

      items.push({
        id: `tx-${tx.id}`,
        kind: "referral_commission",
        type: "earning",
        title: "Referral commission credited",
        body: `${formatSignedAmount(tx.amount)} from ${possessive} bot subscription was added to your Wallet Balance.`,
        time: formatNotificationTime(date),
        amount: tx.amount,
        createdAt: date ?? undefined,
        href: "/referral",
      });
      continue;
    }

    const earningKind = getEarningKind(tx);
    if (earningKind) {
      const notification = buildEarningNotification(tx, earningKind);
      if (notification) items.push(notification);
    }
  }

  return items;
}

function isSupportNotificationItem(
  item: SupportUnreadItem | SupportNotificationItem
): item is SupportNotificationItem {
  return "isUnread" in item;
}

export function buildSupportNotifications(
  items: (SupportUnreadItem | SupportNotificationItem)[]
): AppNotification[] {
  return items.map((item) => {
    const date = item.lastReplyAt
      ? new Date(item.lastReplyAt.seconds * 1000)
      : null;

    return {
      id: `support-${item.ticketId}`,
      kind: "support" as const,
      title: "Support replied",
      body: item.preview || `${item.categoryLabel} — tap to read the response`,
      time: formatNotificationTime(date),
      type: "support" as const,
      createdAt: date ?? undefined,
      unread: isSupportNotificationItem(item) ? item.isUnread : true,
      href: "/account?support=1",
    };
  });
}

export function sortNotificationsChronologically(
  notifications: AppNotification[]
): AppNotification[] {
  return notifications
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aTime = a.item.createdAt?.getTime();
      const bTime = b.item.createdAt?.getTime();

      if (aTime == null && bTime == null) return a.index - b.index;
      if (aTime == null) return 1;
      if (bTime == null) return -1;
      if (bTime !== aTime) return bTime - aTime;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export function buildAppNotifications(
  profile: UserProfile | null,
  transactions: (Transaction & { id: string })[],
  referralSourceNames?: Record<string, string>
): AppNotification[] {
  const items: AppNotification[] = [];

  if (!profile) return items;

  items.push(
    ...buildTransactionNotifications(transactions, referralSourceNames)
  );

  if (!userHasSecurityPin(profile)) {
    items.push({
      id: "security-pin",
      kind: "security",
      title: "Set your security PIN",
      body: "Protect withdrawals by adding a 4-digit PIN in your account settings.",
      time: "ACTION NEEDED",
      type: "security",
      href: "/account",
    });
  }

  if (items.length === 0) {
    items.push({
      id: "welcome",
      kind: "system",
      title: "Welcome to TradIQ",
      body: "Fund your wallet, subscribe to a signal bot, and start earning up to 3% daily.",
      time: "JUST NOW",
      type: "system",
      href: "/bot",
    });
  }

  return items;
}

export { formatNotificationFullDate };
