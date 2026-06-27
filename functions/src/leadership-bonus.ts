import {
  FieldValue,
  Firestore,
} from "firebase-admin/firestore";

type MemberRank = "member" | "leader" | "director" | "ambassador";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const LEADERSHIP_RATES: Record<Exclude<MemberRank, "member">, number> = {
  leader: 0.01,
  director: 0.012,
  ambassador: 0.015,
};

function normalizeMemberRank(value: unknown): MemberRank {
  if (value === "leader" || value === "director" || value === "ambassador") {
    return value;
  }
  return "member";
}

function toDate(value: unknown): Date | null {
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

/** payoutIndex 1 = first payout, due 24h after subscribe. */
function getScheduledPayoutAt(subscribedAt: Date, payoutIndex: number): Date {
  return new Date(subscribedAt.getTime() + payoutIndex * MS_PER_DAY);
}

export interface ApplyLeadershipBonusInput {
  db: Firestore;
  botOwnerUid: string;
  botId: string;
  botAmount: number;
  botSubscribedAt: Date;
  accrualDay: number;
}

/**
 * Daily leadership bonus for L1 uplines with an activated rank.
 * Pays on accruals scheduled on/after rankActivatedAt (including pre-existing
 * active bots). Does not backfill days before activation.
 */
export async function applyLeadershipBonus(
  input: ApplyLeadershipBonusInput
): Promise<{ paid: boolean; amount?: number; uplineUid?: string }> {
  const { db, botOwnerUid, botId, botAmount, botSubscribedAt, accrualDay } =
    input;

  const ownerSnap = await db.collection("users").doc(botOwnerUid).get();
  if (!ownerSnap.exists) return { paid: false };

  const referredBy = ownerSnap.data()?.referredBy as string | null | undefined;
  if (!referredBy) return { paid: false };

  const uplineSnap = await db.collection("users").doc(referredBy).get();
  if (!uplineSnap.exists) return { paid: false };

  const uplineData = uplineSnap.data() ?? {};
  const memberRank = normalizeMemberRank(uplineData.memberRank);
  if (memberRank === "member") return { paid: false };

  const rankActivatedAt = toDate(uplineData.rankActivatedAt);
  if (!rankActivatedAt) return { paid: false };

  const accrualScheduledAt = getScheduledPayoutAt(botSubscribedAt, accrualDay);
  if (accrualScheduledAt.getTime() < rankActivatedAt.getTime()) {
    return { paid: false };
  }

  const rate = LEADERSHIP_RATES[memberRank];
  if (!rate || rate <= 0) return { paid: false };

  const bonus = Math.round(botAmount * rate * 100) / 100;
  if (bonus <= 0) return { paid: false };

  const ledgerRef = db
    .collection("leadershipBonusEvents")
    .doc(`${referredBy}_${botId}_${accrualDay}`);

  const uplineRef = db.collection("users").doc(referredBy);

  const paid = await db.runTransaction(async (tx) => {
    const existing = await tx.get(ledgerRef);
    if (existing.exists) return false;

    tx.set(ledgerRef, {
      uplineUid: referredBy,
      botOwnerUid,
      botId,
      day: accrualDay,
      amount: bonus,
      rate,
      memberRank,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.update(uplineRef, {
      walletBalance: FieldValue.increment(bonus),
    });

    tx.set(uplineRef.collection("transactions").doc(), {
      type: "referral",
      amount: bonus,
      status: "paid",
      title: "Leadership Bonus",
      subtitle: "Daily bonus from Level 1 direct referral bot",
      metadata: {
        kind: "leadership_bonus",
        level: 1,
        fromUserId: botOwnerUid,
        botId,
        day: accrualDay,
        rate,
        memberRank,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    return true;
  });

  return paid
    ? { paid: true, amount: bonus, uplineUid: referredBy }
    : { paid: false };
}
