import { Firestore } from "firebase-admin/firestore";
import { getRemainingScheduledPayouts } from "@/lib/investments";
import { fetchSubscriptionCommissions } from "@/lib/console/commissions";
import { fetchAllUserBots } from "@/lib/console/fetch-bots";
import {
  formatManilaDateLabel,
  getManilaDateWindow,
  manilaDateKey,
  toDateFromUnknown,
} from "@/lib/manila-time";
import { isSuperAdminRole } from "@/lib/roles";

function roundPeso(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface LiabilityCalendarDay {
  dateKey: string;
  label: string;
  interest: number;
  principal: number;
  grossLiability: number;
  approvedWithdrawals: number;
  netExpectedCashout: number;
  isToday: boolean;
}

export async function buildLiabilityCalendar(
  db: Firestore,
  horizonDays = 60
) {
  const window = getManilaDateWindow(horizonDays);
  const buckets = new Map<
    string,
    { interest: number; principal: number; approvedWithdrawals: number }
  >();

  for (const key of window.keys) {
    buckets.set(key, { interest: 0, principal: 0, approvedWithdrawals: 0 });
  }

  const activeBots = await fetchAllUserBots(db, "active", true);
  for (const { data: bot } of activeBots) {
    const payouts = getRemainingScheduledPayouts(
      bot,
      window.startKey,
      window.endKey,
      manilaDateKey
    );
    for (const payout of payouts) {
      const bucket = buckets.get(payout.dateKey);
      if (!bucket) continue;
      bucket.interest += payout.interest;
      bucket.principal += payout.principal;
    }
  }

  const usersSnap = await db.collection("users").get();
  const superAdminIds = new Set(
    usersSnap.docs
      .filter((doc) => isSuperAdminRole(doc.data().role as string | undefined))
      .map((doc) => doc.id)
  );

  const approvedSnap = await db
    .collection("withdrawalRequests")
    .where("status", "==", "approved")
    .get();

  for (const doc of approvedSnap.docs) {
    const data = doc.data();
    if (superAdminIds.has(data.userId as string)) continue;

    const reviewedAt = toDateFromUnknown(data.reviewedAt);
    if (!reviewedAt) continue;

    const dateKey = manilaDateKey(reviewedAt);
    const bucket = buckets.get(dateKey);
    if (!bucket) continue;

    const amount = (data.netPayout as number | undefined) ?? (data.amount as number) ?? 0;
    bucket.approvedWithdrawals += amount;
  }

  let totalGrossLiability = 0;
  let totalApprovedWithdrawals = 0;
  let totalNetExpectedCashout = 0;

  const days: LiabilityCalendarDay[] = window.keys.map((dateKey) => {
    const bucket = buckets.get(dateKey)!;
    const interest = roundPeso(bucket.interest);
    const principal = roundPeso(bucket.principal);
    const grossLiability = roundPeso(interest + principal);
    const approvedWithdrawals = roundPeso(bucket.approvedWithdrawals);
    const netExpectedCashout = Math.max(
      0,
      roundPeso(grossLiability - approvedWithdrawals)
    );

    totalGrossLiability += grossLiability;
    totalApprovedWithdrawals += approvedWithdrawals;
    totalNetExpectedCashout += netExpectedCashout;

    return {
      dateKey,
      label: formatManilaDateLabel(dateKey),
      interest,
      principal,
      grossLiability,
      approvedWithdrawals,
      netExpectedCashout,
      isToday: dateKey === window.todayKey,
    };
  });

  const { summary: commissionsSummary } = await fetchSubscriptionCommissions(
    db,
    "all"
  );

  return {
    days,
    totals: {
      grossLiability: roundPeso(totalGrossLiability),
      approvedWithdrawals: roundPeso(totalApprovedWithdrawals),
      netExpectedCashout: roundPeso(totalNetExpectedCashout),
    },
    commissionsSummary: {
      totalCommissionsPaid: commissionsSummary.totalCommissionsPaid,
      totalAdminCommission: commissionsSummary.totalAdminCommission,
    },
  };
}
