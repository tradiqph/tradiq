import { Timestamp } from "firebase/firestore";
import { manilaDateKey } from "@/lib/manila-time";

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

/** payoutIndex 1 = first payout, due 24h after subscribe. */
export function getScheduledPayoutAt(
  subscribedAt: Date,
  payoutIndex: number
): Date {
  return new Date(subscribedAt.getTime() + payoutIndex * MS_PER_DAY);
}

function wasPayoutAddedOnDate(
  subscribedAt: Date,
  daysAccrued: number,
  dateKey: string
): boolean {
  for (let k = 1; k <= daysAccrued; k++) {
    if (manilaDateKey(getScheduledPayoutAt(subscribedAt, k)) === dateKey) {
      return true;
    }
  }
  return false;
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

  const nextDue = getScheduledPayoutAt(subscribedAt, daysAccrued + 1);
  return now.getTime() >= nextDue.getTime();
}

/** Console display: next 24h payout falls on today's Manila calendar date, or overdue unpaid. */
export function isPayoutScheduledToday(
  bot: BotInvestmentData,
  now = new Date()
): boolean {
  if (bot.status !== "active") return false;

  const daysAccrued = inferDaysAccrued(bot);
  const termDays = getTermDays(bot);
  if (daysAccrued >= termDays) return false;

  if (isDueForAccrual(bot, now)) return true;

  const nextPayout = getNextPayoutAt(bot);
  if (!nextPayout) return false;

  return manilaDateKey(nextPayout) === manilaDateKey(now);
}

export function wasAccruedToday(
  bot: BotInvestmentData,
  now = new Date()
): boolean {
  const subscribedAt = toDate(bot.subscribedAt);
  if (!subscribedAt) return false;

  const daysAccrued = inferDaysAccrued(bot);
  if (daysAccrued === 0) return false;

  return wasPayoutAddedOnDate(
    subscribedAt,
    daysAccrued,
    manilaDateKey(now)
  );
}

export type PayoutTodayStatus = "pending" | "added" | null;

/** Pending = payout due today (not yet credited). Added = 3% credited today. */
/** Payout status for a specific Manila calendar day (pending or already credited). */
export function getPayoutStatusForDate(
  bot: BotInvestmentData,
  dateKey: string,
  now = new Date()
): PayoutTodayStatus {
  if (bot.status !== "active") return null;

  const subscribedAt = toDate(bot.subscribedAt);
  if (!subscribedAt) return null;

  const daysAccrued = inferDaysAccrued(bot);
  if (wasPayoutAddedOnDate(subscribedAt, daysAccrued, dateKey)) {
    return "added";
  }

  if (dateKey === manilaDateKey(now) && isDueForAccrual(bot, now)) {
    return "pending";
  }

  const nextPayout = getNextPayoutAt(bot);
  if (nextPayout && manilaDateKey(nextPayout) === dateKey) {
    return "pending";
  }

  return null;
}

export function getPayoutTodayStatus(
  bot: BotInvestmentData,
  now = new Date()
): PayoutTodayStatus {
  return getPayoutStatusForDate(bot, manilaDateKey(now), now);
}

export function isPayoutTodayView(
  bot: BotInvestmentData,
  now = new Date()
): boolean {
  return getPayoutTodayStatus(bot, now) !== null;
}

export function getNextPayoutAt(bot: BotInvestmentData): Date | null {
  if (bot.status !== "active" || inferDaysAccrued(bot) >= getTermDays(bot)) {
    return null;
  }

  const subscribedAt = toDate(bot.subscribedAt);
  if (!subscribedAt) return null;

  const daysAccrued = inferDaysAccrued(bot);
  return getScheduledPayoutAt(subscribedAt, daysAccrued + 1);
}

/** When the final payout (day 30) and principal return occur. */
export function getMaturityAt(bot: BotInvestmentData): Date | null {
  const subscribedAt = toDate(bot.subscribedAt);
  if (!subscribedAt) return null;

  const termDays = getTermDays(bot);
  const lastAccruedAt = toDate(bot.lastAccruedAt);

  if (bot.status === "completed") {
    return (
      lastAccruedAt ?? getScheduledPayoutAt(subscribedAt, termDays)
    );
  }

  return getScheduledPayoutAt(subscribedAt, termDays);
}

export interface ScheduledPayout {
  dateKey: string;
  interest: number;
  principal: number;
}

export function getRemainingScheduledPayouts(
  bot: BotInvestmentData,
  windowStartKey: string,
  windowEndKey: string,
  dateKeyFn: (d: Date) => string
): ScheduledPayout[] {
  if (bot.status !== "active") return [];

  const remaining = daysRemaining(bot);
  if (remaining === 0) return [];

  const due = dailyPayout(bot.amount, bot.dailyRate ?? DAILY_BOT_RATE);
  const payoutDate = getNextPayoutAt(bot);
  if (!payoutDate) return [];

  const results: ScheduledPayout[] = [];
  let cursor = payoutDate;
  for (let i = 0; i < remaining; i++) {
    const dateKey = dateKeyFn(cursor);
    if (dateKey >= windowStartKey && dateKey <= windowEndKey) {
      const isMaturity = i === remaining - 1;
      results.push({
        dateKey,
        interest: due,
        principal: isMaturity ? bot.amount : 0,
      });
    }
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }

  return results;
}

/** Calendar liability: past = credited slots; today = all slots (stable); future = unpaid only. */
export function getExpectedCalendarDayPayouts(
  bot: BotInvestmentData,
  windowStartKey: string,
  windowEndKey: string,
  todayKey: string,
  dateKeyFn: (d: Date) => string
): ScheduledPayout[] {
  if (bot.status !== "active" && bot.status !== "completed") return [];

  const subscribedAt = toDate(bot.subscribedAt);
  if (!subscribedAt) return [];

  const daysAccrued = inferDaysAccrued(bot);
  const termDays = getTermDays(bot);
  const due = dailyPayout(bot.amount, bot.dailyRate ?? DAILY_BOT_RATE);

  const results: ScheduledPayout[] = [];

  for (let k = 1; k <= termDays; k++) {
    const scheduledAt = getScheduledPayoutAt(subscribedAt, k);
    const dateKey = dateKeyFn(scheduledAt);

    if (dateKey < windowStartKey || dateKey > windowEndKey) continue;

    if (dateKey < todayKey) {
      if (k > daysAccrued) continue;
    } else if (dateKey > todayKey) {
      if (bot.status !== "active") continue;
      if (k <= daysAccrued) continue;
    } else if (bot.status !== "active") {
      continue;
    }

    results.push({
      dateKey,
      interest: due,
      principal: k === termDays ? bot.amount : 0,
    });
  }

  return results;
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
  user?: ConsoleInvestmentUserMeta,
  viewDateKey?: string
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
    payoutTodayStatus: viewDateKey
      ? getPayoutStatusForDate(bot, viewDateKey)
      : getPayoutTodayStatus(bot),
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
