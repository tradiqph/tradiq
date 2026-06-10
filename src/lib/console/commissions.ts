import { Firestore } from "firebase-admin/firestore";
import { buildSubscriptionCommissionBreakdown } from "@/lib/console/commission-breakdown";
import { enrichBotInvestment } from "@/lib/investments";
import { fetchAllUserBots } from "@/lib/console/fetch-bots";
import {
  getReferralTotals,
  normalizeReferralStats,
} from "@/lib/referral-stats";

interface UserMeta {
  email: string;
  displayName: string;
  referredBy: string | null;
  referralTotalEarned: number;
}

async function loadUsersWithUplineChains(
  db: Firestore,
  seedUserIds: string[]
): Promise<{
  userMap: Map<string, UserMeta>;
  referredByMap: Map<string, string | null>;
}> {
  const userMap = new Map<string, UserMeta>();
  const referredByMap = new Map<string, string | null>();
  const queue = [...new Set(seedUserIds)];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const uid = queue.shift()!;
    if (visited.has(uid)) continue;
    visited.add(uid);

    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) {
      referredByMap.set(uid, null);
      continue;
    }

    const d = snap.data()!;
    const referredBy = (d.referredBy as string | undefined) ?? null;
    referredByMap.set(uid, referredBy);

    const referral = getReferralTotals(normalizeReferralStats(d.referralStats));
    userMap.set(uid, {
      email: d.email ?? "",
      displayName: d.displayName ?? "",
      referredBy,
      referralTotalEarned: referral.totalEarned,
    });

    if (referredBy && !visited.has(referredBy)) {
      queue.push(referredBy);
    }
  }

  return { userMap, referredByMap };
}

export async function fetchSubscriptionCommissions(
  db: Firestore,
  status: "active" | "completed" | "all" = "all"
) {
  const botRefs =
    status === "all"
      ? await fetchAllUserBots(db, undefined, true)
      : await fetchAllUserBots(db, status, true);

  const userIds = [...new Set(botRefs.map((b) => b.userId))];
  const { userMap, referredByMap } = await loadUsersWithUplineChains(db, userIds);

  const rows = botRefs.map(({ userId, botId, data }) => {
    const user = userMap.get(userId);
    const investment = enrichBotInvestment(data, userId, botId, user);
    const directUpline = user?.referredBy
      ? userMap.get(user.referredBy) ?? null
      : null;
    const breakdown = buildSubscriptionCommissionBreakdown(
      investment.amount,
      user?.referredBy ?? null,
      referredByMap,
      userMap
    );

    return {
      id: investment.id,
      userId: investment.userId,
      email: investment.email,
      displayName: investment.displayName,
      amount: investment.amount,
      status: investment.status,
      subscribedAt: investment.subscribedAt,
      referrerDisplayName: directUpline?.displayName ?? null,
      referrerEmail: directUpline?.email ?? null,
      directReferralCommission: breakdown.directReferralCommission,
      subscriptionCommissionTotal: breakdown.subscriptionCommissionTotal,
      adminCommissionTotal: breakdown.adminCommissionTotal,
      levelCommissions: breakdown.levelCommissions,
      memberReferralEarned: user?.referralTotalEarned ?? 0,
    };
  });

  const withReferrer = rows.filter((row) => row.subscriptionCommissionTotal > 0);

  const summary = {
    count: rows.length,
    withReferrerCount: withReferrer.length,
    totalCommissionsPaid: Math.round(
      rows.reduce((sum, row) => sum + row.subscriptionCommissionTotal, 0) * 100
    ) / 100,
    totalAdminCommission: Math.round(
      rows.reduce((sum, row) => sum + row.adminCommissionTotal, 0) * 100
    ) / 100,
    directCommissionsPaid: Math.round(
      rows.reduce((sum, row) => sum + row.directReferralCommission, 0) * 100
    ) / 100,
    totalSubPrincipal: Math.round(
      rows.reduce((sum, row) => sum + row.amount, 0) * 100
    ) / 100,
  };

  return {
    commissions: rows.sort((a, b) =>
      (b.subscribedAt ?? "").localeCompare(a.subscribedAt ?? "")
    ),
    summary,
  };
}
