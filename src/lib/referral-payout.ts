import { FieldValue, Firestore } from "firebase-admin/firestore";
import {
  REFERRAL_RATES,
  calculateReferralCommissions,
} from "@/lib/finance";
import {
  createEmptyReferralStats,
  normalizeReferralStats,
  type ReferralStats,
} from "@/lib/referral-stats";

async function ensureReferralStatsStructure(
  db: Firestore,
  userRef: FirebaseFirestore.DocumentReference
): Promise<ReferralStats> {
  const snap = await userRef.get();
  const stats = normalizeReferralStats(snap.data()?.referralStats);

  if (snap.data()?.referralStats?.levels?.length !== REFERRAL_RATES.length) {
    await userRef.set({ referralStats: stats }, { merge: true });
  }

  return stats;
}

function applyLevelCommission(
  stats: ReferralStats,
  level: number,
  amount: number,
  commission: number
) {
  stats.levels[level].invested =
    Math.round((stats.levels[level].invested + amount) * 100) / 100;
  stats.levels[level].earned =
    Math.round((stats.levels[level].earned + commission) * 100) / 100;
  stats.totalEarned =
    Math.round((stats.totalEarned + commission) * 100) / 100;
}

/**
 * One-time commission when a downline subscribes to a bot.
 * Does NOT run on daily bot earnings, deposits, or principal returns —
 * those belong entirely to the investor.
 */
export async function applyReferralCommissions(
  db: Firestore,
  subscriberUid: string,
  amount: number
) {
  const userSnap = await db.collection("users").doc(subscriberUid).get();
  if (!userSnap.exists) return;

  const subscriberData = userSnap.data() ?? {};
  const fromUserDisplayName =
    (subscriberData.displayName as string | undefined)?.trim() ?? "";
  const fromUserEmail =
    (subscriberData.email as string | undefined)?.trim() ?? "";

  let uplineUid: string | null = subscriberData.referredBy ?? null;
  if (!uplineUid) return;

  const commissions = calculateReferralCommissions(amount);

  for (let level = 0; level < REFERRAL_RATES.length && uplineUid; level++) {
    const referrerUid: string = uplineUid;
    const commission = commissions[level];
    const referrerRef = db.collection("users").doc(referrerUid);

    await db.runTransaction(async (tx) => {
      const referrerSnap = await tx.get(referrerRef);
      if (!referrerSnap.exists) return;

      const stats = normalizeReferralStats(referrerSnap.data()?.referralStats);
      applyLevelCommission(stats, level, amount, commission);

      tx.update(referrerRef, {
        walletBalance: FieldValue.increment(commission),
        referralStats: stats,
      });

      tx.set(referrerRef.collection("transactions").doc(), {
        type: "referral",
        amount: commission,
        status: "paid",
        title: `Referral L${level + 1}`,
        subtitle: "Commission from bot investment",
        metadata: {
          level: level + 1,
          fromUserId: subscriberUid,
          fromUserDisplayName: fromUserDisplayName || null,
          fromUserEmail: fromUserEmail || null,
          investmentAmount: amount,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    const uplineSnap = await db.collection("users").doc(referrerUid).get();
    uplineUid = (uplineSnap.data()?.referredBy as string | undefined) ?? null;
  }
}

export interface TrackReferralSignupOptions {
  /** True when the user signed up with a referral code (retry if upline not linked yet). */
  hadReferralCode?: boolean;
}

/** Increment member counts up the chain when a new user signs up with a referral. */
export async function trackReferralSignup(
  db: Firestore,
  newUserUid: string,
  options: TrackReferralSignupOptions = {}
) {
  const userRef = db.collection("users").doc(newUserUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists || userSnap.data()?.referralNetworkTracked) return;

  let uplineUid: string | null = userSnap.data()?.referredBy ?? null;
  if (!uplineUid) {
    if (!options.hadReferralCode) {
      await userRef.update({ referralNetworkTracked: true });
    }
    return;
  }

  for (let level = 0; level < REFERRAL_RATES.length && uplineUid; level++) {
    const referrerUid: string = uplineUid;
    const uplineRef = db.collection("users").doc(referrerUid);

    await db.runTransaction(async (tx) => {
      const uplineSnap = await tx.get(uplineRef);
      if (!uplineSnap.exists) return;

      const stats = normalizeReferralStats(uplineSnap.data()?.referralStats);
      stats.levels[level].members += 1;
      tx.update(uplineRef, { referralStats: stats });
    });

    const uplineSnap = await db.collection("users").doc(referrerUid).get();
    uplineUid = (uplineSnap.data()?.referredBy as string | undefined) ?? null;
  }

  await userRef.update({
    referralNetworkTracked: true,
    signupReferralCode: FieldValue.delete(),
  });
}

export function defaultReferralStatsForNewUser() {
  return createEmptyReferralStats();
}
