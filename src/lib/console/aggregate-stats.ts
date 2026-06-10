import { Firestore } from "firebase-admin/firestore";
import { enrichBotInvestment } from "@/lib/investments";
import { fetchAllUserBots } from "@/lib/console/fetch-bots";
import {
  getReferralTotals,
  normalizeReferralStats,
} from "@/lib/referral-stats";

export async function aggregateConsoleStats(db: Firestore) {
  const usersSnap = await db.collection("users").get();

  let totalWallet = 0;
  let totalDeposit = 0;
  let totalDeposited = 0;
  let totalWithdrawn = 0;
  let totalBotEarnings = 0;
  let totalReferralEarned = 0;
  let totalReferralInvested = 0;

  for (const doc of usersSnap.docs) {
    const d = doc.data();
    totalWallet += d.walletBalance ?? 0;
    totalDeposit += d.depositBalance ?? 0;
    totalDeposited += d.totalDeposited ?? 0;
    totalWithdrawn += d.totalWithdrawn ?? 0;
    totalBotEarnings += d.totalEarnings ?? 0;

    const referral = getReferralTotals(normalizeReferralStats(d.referralStats));
    totalReferralEarned += referral.totalEarned;
    totalReferralInvested += referral.totalInvested;
  }

  const pendingSnap = await db
    .collection("withdrawalRequests")
    .where("status", "==", "pending")
    .get();

  let pendingWithdrawalAmount = 0;
  for (const doc of pendingSnap.docs) {
    pendingWithdrawalAmount += doc.data().amount ?? 0;
  }

  const activeBots = await fetchAllUserBots(db, "active");

  let activePrincipal = 0;
  let todayLiability = 0;
  let dueTodayCount = 0;
  let completingTodayCount = 0;

  for (const { userId, botId, data: bot } of activeBots) {
    activePrincipal += bot.amount ?? 0;

    const enriched = enrichBotInvestment(bot, userId, botId);

    if (enriched.dueToday) {
      todayLiability += enriched.dailyDue;
      dueTodayCount += 1;
    }
    if (enriched.completingToday) {
      completingTodayCount += 1;
    }
  }

  return {
    totalMembers: usersSnap.size,
    pendingWithdrawals: pendingSnap.size,
    pendingWithdrawalAmount: Math.round(pendingWithdrawalAmount * 100) / 100,
    activeInvestments: activeBots.length,
    activePrincipal: Math.round(activePrincipal * 100) / 100,
    todayPayoutLiability: Math.round(todayLiability * 100) / 100,
    dueTodayCount,
    completingTodayCount,
    totalWallet: Math.round(totalWallet * 100) / 100,
    totalDeposit: Math.round(totalDeposit * 100) / 100,
    totalDeposited: Math.round(totalDeposited * 100) / 100,
    totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
    totalBotEarnings: Math.round(totalBotEarnings * 100) / 100,
    totalReferralEarned: Math.round(totalReferralEarned * 100) / 100,
    totalReferralInvested: Math.round(totalReferralInvested * 100) / 100,
  };
}

export async function fetchAllInvestments(
  db: Firestore,
  status: "active" | "completed" | "all" = "all",
  dueTodayOnly = false
) {
  const botRefs =
    status === "all"
      ? await fetchAllUserBots(db)
      : await fetchAllUserBots(db, status);

  const userIds = [...new Set(botRefs.map((b) => b.userId))];
  const userMap = new Map<string, { email: string; displayName: string }>();

  await Promise.all(
    userIds.map(async (uid) => {
      const snap = await db.collection("users").doc(uid).get();
      if (snap.exists) {
        const d = snap.data()!;
        userMap.set(uid, {
          email: d.email ?? "",
          displayName: d.displayName ?? "",
        });
      }
    })
  );

  const investments = botRefs.map(({ userId, botId, data }) =>
    enrichBotInvestment(data, userId, botId, userMap.get(userId))
  );

  const filtered = dueTodayOnly
    ? investments.filter((i) => i.dueToday)
    : investments;

  const summary = {
    count: investments.length,
    activePrincipal: investments
      .filter((i) => i.status === "active")
      .reduce((s, i) => s + i.amount, 0),
    todayLiability: investments
      .filter((i) => i.dueToday)
      .reduce((s, i) => s + i.dailyDue, 0),
    dueTodayCount: investments.filter((i) => i.dueToday).length,
    completingTodayCount: investments.filter((i) => i.completingToday).length,
    remainingPayoutLiability: investments.reduce(
      (s, i) => s + i.remainingPayout,
      0
    ),
  };

  return {
    investments: filtered.sort((a, b) =>
      (b.subscribedAt ?? "").localeCompare(a.subscribedAt ?? "")
    ),
    summary: {
      ...summary,
      todayLiability: Math.round(summary.todayLiability * 100) / 100,
      activePrincipal: Math.round(summary.activePrincipal * 100) / 100,
      remainingPayoutLiability:
        Math.round(summary.remainingPayoutLiability * 100) / 100,
    },
  };
}
