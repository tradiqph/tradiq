import { Firestore } from "firebase-admin/firestore";
import {
  enrichBotInvestment,
  type BotInvestmentData,
} from "@/lib/investments";

export async function aggregateConsoleStats(db: Firestore) {
  const usersSnap = await db.collection("users").get();

  let totalWallet = 0;
  let totalDeposit = 0;
  let totalDeposited = 0;
  let totalWithdrawn = 0;

  for (const doc of usersSnap.docs) {
    const d = doc.data();
    totalWallet += d.walletBalance ?? 0;
    totalDeposit += d.depositBalance ?? 0;
    totalDeposited += d.totalDeposited ?? 0;
    totalWithdrawn += d.totalWithdrawn ?? 0;
  }

  const pendingSnap = await db
    .collection("withdrawalRequests")
    .where("status", "==", "pending")
    .get();

  let pendingWithdrawalAmount = 0;
  for (const doc of pendingSnap.docs) {
    pendingWithdrawalAmount += doc.data().amount ?? 0;
  }

  const activeBotsSnap = await db
    .collectionGroup("bots")
    .where("status", "==", "active")
    .get();

  let activePrincipal = 0;
  let todayLiability = 0;
  let dueTodayCount = 0;
  let completingTodayCount = 0;

  for (const botDoc of activeBotsSnap.docs) {
    const bot = botDoc.data() as BotInvestmentData;
    activePrincipal += bot.amount ?? 0;

    const enriched = enrichBotInvestment(
      bot,
      botDoc.ref.parent.parent?.id ?? "",
      botDoc.id
    );

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
    pendingWithdrawalAmount,
    activeInvestments: activeBotsSnap.size,
    activePrincipal,
    todayPayoutLiability: Math.round(todayLiability * 100) / 100,
    dueTodayCount,
    completingTodayCount,
    totalWallet: Math.round(totalWallet * 100) / 100,
    totalDeposit: Math.round(totalDeposit * 100) / 100,
    totalDeposited: Math.round(totalDeposited * 100) / 100,
    totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
  };
}

export async function fetchAllInvestments(
  db: Firestore,
  status: "active" | "completed" | "all" = "all",
  dueTodayOnly = false
) {
  let query = db.collectionGroup("bots") as FirebaseFirestore.Query;

  if (status !== "all") {
    query = query.where("status", "==", status);
  }

  const botsSnap = await query.get();
  const userIds = new Set<string>();
  for (const doc of botsSnap.docs) {
    const uid = doc.ref.parent.parent?.id;
    if (uid) userIds.add(uid);
  }

  const userMap = new Map<string, { email: string; displayName: string }>();
  await Promise.all(
    Array.from(userIds).map(async (uid) => {
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

  const investments = botsSnap.docs.map((doc) => {
    const userId = doc.ref.parent.parent?.id ?? "";
    const bot = doc.data() as BotInvestmentData;
    return enrichBotInvestment(bot, userId, doc.id, userMap.get(userId));
  });

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
  };

  return {
    investments: filtered.sort((a, b) =>
      (b.subscribedAt ?? "").localeCompare(a.subscribedAt ?? "")
    ),
    summary: {
      ...summary,
      todayLiability: Math.round(summary.todayLiability * 100) / 100,
      activePrincipal: Math.round(summary.activePrincipal * 100) / 100,
    },
  };
}
