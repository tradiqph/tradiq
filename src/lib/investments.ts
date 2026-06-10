import { Timestamp } from "firebase/firestore";

export const BOT_TERM_DAYS = 30;
export const DAILY_BOT_RATE = 0.03;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface BotInvestmentData {
  amount: number;
  status: "active" | "completed";
  dailyRate?: number;
  subscribedAt?: Timestamp | { seconds: number } | Date | null;
  lastAccruedAt?: Timestamp | { seconds: number } | Date | null;
  totalAccrued?: number;
  daysAccrued?: number;
  termDays?: number;
}

function toDate(
  value?: Timestamp | { seconds: number } | Date | null
): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate();
  }
  if (typeof (value as { seconds: number }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
}

export function dailyPayout(amount: number, rate = DAILY_BOT_RATE): number {
  return Math.round(amount * rate * 100) / 100;
}

export function inferDaysAccrued(bot: BotInvestmentData): number {
  if (typeof bot.daysAccrued === "number") return bot.daysAccrued;
  if (!bot.amount || !bot.totalAccrued) return 0;
  const perDay = dailyPayout(bot.amount);
  if (perDay <= 0) return 0;
  return Math.min(
    bot.termDays ?? BOT_TERM_DAYS,
    Math.round(bot.totalAccrued / perDay)
  );
}

export function getTermDays(bot: BotInvestmentData): number {
  return bot.termDays ?? BOT_TERM_DAYS;
}

export function daysRemaining(bot: BotInvestmentData): number {
  return Math.max(0, getTermDays(bot) - inferDaysAccrued(bot));
}

export function isDueForAccrual(
  bot: BotInvestmentData,
  now = new Date()
): boolean {
  if (bot.status !== "active") return false;

  const daysAccrued = inferDaysAccrued(bot);
  const termDays = getTermDays(bot);
  if (daysAccrued >= termDays) return false;

  const subscribedAt = toDate(bot.subscribedAt);
  if (!subscribedAt) return false;

  const lastAccruedAt = toDate(bot.lastAccruedAt);
  const anchor = lastAccruedAt ?? subscribedAt;
  return now.getTime() - anchor.getTime() >= MS_PER_DAY;
}

export function getNextPayoutAt(bot: BotInvestmentData): Date | null {
  if (bot.status !== "active" || inferDaysAccrued(bot) >= getTermDays(bot)) {
    return null;
  }

  const subscribedAt = toDate(bot.subscribedAt);
  if (!subscribedAt) return null;

  const lastAccruedAt = toDate(bot.lastAccruedAt);
  const anchor = lastAccruedAt ?? subscribedAt;
  return new Date(anchor.getTime() + MS_PER_DAY);
}

/** When the final payout (day 30) and principal return occur. */
export function getMaturityAt(bot: BotInvestmentData): Date | null {
  const subscribedAt = toDate(bot.subscribedAt);
  if (!subscribedAt) return null;

  const termDays = getTermDays(bot);
  const daysAccrued = inferDaysAccrued(bot);
  const lastAccruedAt = toDate(bot.lastAccruedAt);

  if (bot.status === "completed") {
    return lastAccruedAt ?? new Date(subscribedAt.getTime() + termDays * MS_PER_DAY);
  }

  const payoutsRemaining = Math.max(0, termDays - daysAccrued);
  const anchor = lastAccruedAt ?? subscribedAt;
  return new Date(anchor.getTime() + payoutsRemaining * MS_PER_DAY);
}

export interface ConsoleInvestmentUserMeta {
  email?: string;
  displayName?: string;
}

export function calculateRemainingBotPayout(
  amount: number,
  status: string,
  daysAccrued: number,
  termDays: number,
  dailyDue: number
): number {
  if (status !== "active") return 0;
  const payoutsLeft = Math.max(0, termDays - daysAccrued);
  if (payoutsLeft === 0) return 0;
  return Math.round((payoutsLeft * dailyDue + amount) * 100) / 100;
}

export function enrichBotInvestment(
  bot: BotInvestmentData,
  userId: string,
  botId: string,
  user?: ConsoleInvestmentUserMeta
) {
  const daysAccrued = inferDaysAccrued(bot);
  const termDays = getTermDays(bot);
  const due = dailyPayout(bot.amount, bot.dailyRate ?? DAILY_BOT_RATE);

  return {
    id: botId,
    userId,
    email: user?.email ?? "",
    displayName: user?.displayName ?? "",
    amount: bot.amount,
    status: bot.status,
    daysAccrued,
    termDays,
    daysRemaining: Math.max(0, termDays - daysAccrued),
    dailyDue: due,
    totalAccrued: bot.totalAccrued ?? 0,
    dueToday: isDueForAccrual(bot),
    completingToday:
      bot.status === "active" &&
      daysAccrued === termDays - 1 &&
      isDueForAccrual(bot),
    subscribedAt: toDate(bot.subscribedAt)?.toISOString() ?? null,
    lastAccruedAt: toDate(bot.lastAccruedAt)?.toISOString() ?? null,
    nextPayoutAt: getNextPayoutAt(bot)?.toISOString() ?? null,
    maturityAt: getMaturityAt(bot)?.toISOString() ?? null,
    remainingPayout: calculateRemainingBotPayout(
      bot.amount,
      bot.status,
      daysAccrued,
      termDays,
      due
    ),
  };
}
