import {
  FieldValue,
  Firestore,
  DocumentReference,
  Timestamp,
} from "firebase-admin/firestore";

export const DAILY_BOT_RATE = 0.03;
export const BOT_TERM_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof (value as { seconds: number }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
}

export function inferDaysAccrued(
  bot: FirebaseFirestore.DocumentData
): number {
  if (typeof bot.daysAccrued === "number") return bot.daysAccrued;
  const amount = bot.amount as number;
  const totalAccrued = (bot.totalAccrued as number) ?? 0;
  if (!amount || !totalAccrued) return 0;
  const perDay = Math.round(amount * DAILY_BOT_RATE * 100) / 100;
  if (perDay <= 0) return 0;
  const termDays = (bot.termDays as number) ?? BOT_TERM_DAYS;
  return Math.min(termDays, Math.round(totalAccrued / perDay));
}

/** payoutIndex 1 = first payout, due 24h after subscribe. */
export function getScheduledPayoutAt(
  subscribedAt: Date,
  payoutIndex: number
): Date {
  return new Date(subscribedAt.getTime() + payoutIndex * MS_PER_DAY);
}

export function isDueForAccrual(
  bot: FirebaseFirestore.DocumentData,
  now: Date
): boolean {
  if (bot.status !== "active") return false;

  const daysAccrued = inferDaysAccrued(bot);
  const termDays = (bot.termDays as number) ?? BOT_TERM_DAYS;
  if (daysAccrued >= termDays) return false;

  const subscribedAt = toDate(bot.subscribedAt);
  if (!subscribedAt) return false;

  const nextDue = getScheduledPayoutAt(subscribedAt, daysAccrued + 1);
  return now.getTime() >= nextDue.getTime();
}

export interface BotAccrualResult {
  processed: boolean;
  botId: string;
  userId?: string;
  earning?: number;
  newDaysAccrued?: number;
  completed?: boolean;
  reason?: string;
}

/** Credit exactly one day of bot interest (and principal on final day). */
export async function processOneBotAccrual(
  db: Firestore,
  botDocRef: DocumentReference,
  now: Date
): Promise<BotAccrualResult> {
  const botId = botDocRef.id;
  const userRef = botDocRef.parent.parent;
  if (!userRef) {
    return { processed: false, botId, reason: "missing_user_ref" };
  }

  const userId = userRef.id;
  const preSnap = await botDocRef.get();
  if (!preSnap.exists) {
    return { processed: false, botId, userId, reason: "bot_not_found" };
  }

  const preBot = preSnap.data()!;
  if (!isDueForAccrual(preBot, now)) {
    return { processed: false, botId, userId, reason: "not_due" };
  }

  const amount = preBot.amount as number;
  const rate = (preBot.dailyRate as number) ?? DAILY_BOT_RATE;
  const earning = Math.round(amount * rate * 100) / 100;
  if (earning <= 0) {
    return { processed: false, botId, userId, reason: "zero_earning" };
  }

  const daysAccrued = inferDaysAccrued(preBot);
  const termDays = (preBot.termDays as number) ?? BOT_TERM_DAYS;
  const newDaysAccrued = daysAccrued + 1;
  const isComplete = newDaysAccrued >= termDays;

  let credited = false;

  await db.runTransaction(async (tx) => {
    const botSnap = await tx.get(botDocRef);
    if (!botSnap.exists) return;

    const bot = botSnap.data()!;
    if (!isDueForAccrual(bot, now)) return;

    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return;

    const freshDaysAccrued = inferDaysAccrued(bot);
    const freshTermDays = (bot.termDays as number) ?? BOT_TERM_DAYS;
    const nextDaysAccrued = freshDaysAccrued + 1;
    const complete = nextDaysAccrued >= freshTermDays;

    const subscribedAt = toDate(bot.subscribedAt);
    if (!subscribedAt) return;

    let walletIncrement = earning;
    if (complete) {
      walletIncrement += amount;
    }

    tx.update(userRef, {
      walletBalance: FieldValue.increment(walletIncrement),
      totalEarnings: FieldValue.increment(earning),
    });

    tx.update(botDocRef, {
      totalAccrued: FieldValue.increment(earning),
      daysAccrued: nextDaysAccrued,
      lastAccruedAt: Timestamp.fromDate(
        getScheduledPayoutAt(subscribedAt, nextDaysAccrued)
      ),
      ...(complete ? { status: "completed" } : {}),
    });

    tx.set(userRef.collection("transactions").doc(), {
      type: "earning",
      amount: earning,
      status: "paid",
      title: complete ? "Final Bot Earnings" : "Daily Bot Earnings",
      subtitle: complete
        ? "3% daily return — term complete"
        : "3% daily return",
      metadata: { botId, day: nextDaysAccrued },
      createdAt: FieldValue.serverTimestamp(),
    });

    if (complete) {
      tx.set(userRef.collection("transactions").doc(), {
        type: "earning",
        amount,
        status: "paid",
        title: "Principal Returned",
        subtitle: "Bot investment completed — principal to wallet",
        metadata: { botId },
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    credited = true;
  });

  if (!credited) {
    return { processed: false, botId, userId, reason: "transaction_skipped" };
  }

  return {
    processed: true,
    botId,
    userId,
    earning,
    newDaysAccrued,
    completed: isComplete,
  };
}

export interface BotAccrualBatchSummary {
  dueCount: number;
  processedCount: number;
  results: BotAccrualResult[];
}

/** Ops visibility for console — server writes only. */
export async function recordAccrualRun(
  db: Firestore,
  summary: BotAccrualBatchSummary,
  source: "scheduler" | "manual"
): Promise<void> {
  await db.collection("platform").doc("accrual").set(
    {
      lastRunAt: FieldValue.serverTimestamp(),
      dueCount: summary.dueCount,
      processedCount: summary.processedCount,
      source,
    },
    { merge: true }
  );
}

/** Process at most one accrual per due active bot. */
export async function runBotAccrualBatch(
  db: Firestore,
  now = new Date()
): Promise<BotAccrualBatchSummary> {
  const botsSnap = await db
    .collectionGroup("bots")
    .where("status", "==", "active")
    .get();

  const results: BotAccrualResult[] = [];
  let dueCount = 0;
  let processedCount = 0;

  for (const botDoc of botsSnap.docs) {
    const bot = botDoc.data();
    if (!isDueForAccrual(bot, now)) continue;

    dueCount += 1;
    const result = await processOneBotAccrual(db, botDoc.ref, now);
    results.push(result);
    if (result.processed) processedCount += 1;
  }

  return { dueCount, processedCount, results };
}
