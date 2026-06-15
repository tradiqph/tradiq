import { Firestore } from "firebase-admin/firestore";
import { REFERRAL_RATES } from "@/lib/finance";
import {
  BOT_TERM_DAYS,
  dailyPayout,
  type BotInvestmentData,
} from "@/lib/investments";
import {
  buildDownlineLevels,
  parseUserRecords,
  type NetworkUserRecord,
} from "@/lib/console/member-network";
import {
  createEmptyReferralStats,
  normalizeReferralStats,
} from "@/lib/referral-stats";
import { fetchAllUserBots } from "@/lib/console/fetch-bots";

function inferDaysAccruedFromBot(data: BotInvestmentData): number {
  const amount = data.amount ?? 0;
  const totalAccrued = data.totalAccrued ?? 0;
  const perDay = dailyPayout(amount, data.dailyRate);
  if (perDay <= 0 || !totalAccrued) return data.daysAccrued ?? 0;
  return Math.min(
    data.termDays ?? BOT_TERM_DAYS,
    Math.round(totalAccrued / perDay)
  );
}

/** Rebuild per-level referral stats from the user tree + referral transactions. */
export async function syncReferralStats(db: Firestore): Promise<number> {
  const usersSnap = await db.collection("users").get();
  const userMap = new Map<string, { referredBy: string | null }>();

  for (const doc of usersSnap.docs) {
    userMap.set(doc.id, { referredBy: doc.data().referredBy ?? null });
  }

  const statsByUser = new Map(
    usersSnap.docs.map((d) => [d.id, createEmptyReferralStats()])
  );

  for (const { referredBy } of userMap.values()) {
    let currentUpline = referredBy;
    let level = 0;
    while (currentUpline && level < REFERRAL_RATES.length) {
      statsByUser.get(currentUpline)!.levels[level].members += 1;
      currentUpline = userMap.get(currentUpline)?.referredBy ?? null;
      level += 1;
    }
  }

  let updated = 0;

  for (const userDoc of usersSnap.docs) {
    const stats = statsByUser.get(userDoc.id)!;

    const txSnap = await userDoc.ref
      .collection("transactions")
      .where("type", "==", "referral")
      .get();

    for (const tx of txSnap.docs) {
      const data = tx.data();
      const level = (data.metadata?.level as number) ?? 1;
      const idx = level - 1;
      if (idx < 0 || idx >= REFERRAL_RATES.length) continue;

      const amount = data.amount ?? 0;
      const invested =
        (data.metadata?.investmentAmount as number) ??
        Math.round((amount / REFERRAL_RATES[idx]) * 100) / 100;

      stats.levels[idx].earned += amount;
      stats.levels[idx].invested += invested;
    }

    stats.totalEarned = stats.levels.reduce((s, l) => s + l.earned, 0);

    await userDoc.ref.set(
      {
        referralStats: stats,
        referralNetworkTracked: Boolean(userDoc.data().referredBy),
      },
      { merge: true }
    );
    updated += 1;
  }

  return updated;
}

/** Sync stored member counts for one user from the live referredBy tree. */
export async function reconcileReferralMemberCounts(
  db: Firestore,
  userId: string,
  users?: NetworkUserRecord[]
): Promise<boolean> {
  let userRecords = users;
  if (!userRecords) {
    const usersSnap = await db.collection("users").get();
    userRecords = parseUserRecords(usersSnap.docs);
  }

  const downlineLevels = buildDownlineLevels(userId, userRecords);
  const liveCounts = downlineLevels.map((level) => level.length);

  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) return false;

  const stats = normalizeReferralStats(userSnap.data()?.referralStats);
  let changed = false;

  for (let i = 0; i < REFERRAL_RATES.length; i++) {
    const live = liveCounts[i] ?? 0;
    if (stats.levels[i].members !== live) {
      stats.levels[i].members = live;
      changed = true;
    }
  }

  if (!changed) return false;

  await userSnap.ref.set({ referralStats: stats }, { merge: true });
  return true;
}

export async function reconcileUplineReferralMemberCounts(
  db: Firestore,
  startUplineUid: string,
  users?: NetworkUserRecord[]
): Promise<void> {
  let userRecords = users;
  if (!userRecords) {
    const usersSnap = await db.collection("users").get();
    userRecords = parseUserRecords(usersSnap.docs);
  }

  const userById = new Map(userRecords.map((user) => [user.id, user]));
  let uplineUid: string | null = startUplineUid;

  for (let level = 0; level < REFERRAL_RATES.length && uplineUid; level++) {
    await reconcileReferralMemberCounts(db, uplineUid, userRecords);
    uplineUid = userById.get(uplineUid)?.referredBy ?? null;
  }
}

export async function syncUserTotalEarnings(db: Firestore): Promise<number> {
  const usersSnap = await db.collection("users").get();
  let updated = 0;

  for (const userDoc of usersSnap.docs) {
    const txSnap = await userDoc.ref.collection("transactions").get();
    let totalEarnings = 0;

    for (const tx of txSnap.docs) {
      const data = tx.data();
      if (data.type !== "earning" || data.status !== "paid") continue;
      if (data.title === "Principal Returned") continue;
      totalEarnings += data.amount ?? 0;
    }

    totalEarnings = Math.round(totalEarnings * 100) / 100;
    const current = userDoc.data().totalEarnings ?? 0;

    if (Math.abs(current - totalEarnings) > 0.001) {
      await userDoc.ref.update({ totalEarnings });
      updated += 1;
    }
  }

  return updated;
}

export async function syncBotInvestmentFields(db: Firestore): Promise<number> {
  const botRefs = await fetchAllUserBots(db);
  let updated = 0;

  for (const { userId, botId, data } of botRefs) {
    const daysAccrued = inferDaysAccruedFromBot(data);
    const termDays = data.termDays ?? BOT_TERM_DAYS;
    const needsUpdate =
      data.daysAccrued !== daysAccrued || data.termDays !== termDays;

    if (!needsUpdate) continue;

    await db
      .collection("users")
      .doc(userId)
      .collection("bots")
      .doc(botId)
      .update({ daysAccrued, termDays });
    updated += 1;
  }

  return updated;
}
