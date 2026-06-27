import type { Firestore } from "firebase-admin/firestore";
import { buildDownlineLevels, parseUserRecords } from "@/lib/console/member-network";
import { normalizeMemberRank } from "@/lib/ranks/config";
import { isQaOverrideActive, LEADER_QA_METRICS } from "@/lib/console/qa-eligibility-shared";
import { getRankBadge } from "@/lib/ranks/display";
import {
  evaluateAllRankProgress,
  fetchLifetimeBotInvestmentByUserIds,
  getDirectReferralStats,
  getGroupSales,
  getPersonalInvestment,
  type RankMetrics,
} from "@/lib/ranks/progress";
import { normalizeReferralStats } from "@/lib/referral-stats";

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof (value as { seconds: number }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString();
  }
  return null;
}

export async function loadRankMetrics(
  db: Firestore,
  userId: string
): Promise<{
  metrics: RankMetrics;
  currentRank: ReturnType<typeof normalizeMemberRank>;
  rankActivatedAt: string | null;
  qaOverrideActive: boolean;
}> {
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    throw new Error("User not found");
  }

  const userData = userSnap.data() ?? {};
  const currentRank = normalizeMemberRank(userData.memberRank);
  const rankActivatedAt = toIsoString(userData.rankActivatedAt);
  const qaOverrideActive = isQaOverrideActive(userData);

  if (qaOverrideActive) {
    return {
      metrics: LEADER_QA_METRICS,
      currentRank,
      rankActivatedAt,
      qaOverrideActive: true,
    };
  }

  const ownBotsSnap = await userSnap.ref.collection("bots").get();
  const personalInvestment = getPersonalInvestment(
    ownBotsSnap.docs.map((doc) => doc.data().amount ?? 0)
  );

  const allUsersSnap = await db.collection("users").get();
  const users = parseUserRecords(allUsersSnap.docs);
  const levels = buildDownlineLevels(userId, users);
  const l1Members = levels[0] ?? [];
  const l1MemberIds = l1Members.map((member) => member.id);

  const botTotals = await fetchLifetimeBotInvestmentByUserIds(
    db,
    [userId, ...l1MemberIds]
  );

  const directStats = getDirectReferralStats(
    l1MemberIds,
    botTotals,
    10_000
  );

  const groupSales = getGroupSales(
    normalizeReferralStats(userData.referralStats)
  );

  const metrics: RankMetrics = {
    personalInvestment,
    qualifiedDirectReferrals: directStats.qualifiedCount,
    eachReferralMet: directStats.eachReferralMet,
    directReferralCount: directStats.directReferralCount,
    groupSales,
  };

  return {
    metrics,
    currentRank,
    rankActivatedAt,
    qaOverrideActive: false,
  };
}

export async function loadRankProgressResponse(db: Firestore, userId: string) {
  const { metrics, currentRank, rankActivatedAt, qaOverrideActive } =
    await loadRankMetrics(db, userId);
  const ranks = evaluateAllRankProgress(metrics, currentRank);

  return {
    currentRank,
    currentBadge: getRankBadge(currentRank),
    rankActivatedAt,
    metrics,
    ranks,
    qaOverrideActive,
  };
}
