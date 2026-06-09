import { FieldValue, Firestore } from "firebase-admin/firestore";
import {
  REFERRAL_RATES,
  calculateReferralCommissions,
} from "@/lib/finance";
import { createEmptyReferralStats, normalizeReferralStats } from "@/lib/referral-stats";

async function ensureReferralStatsStructure(
  db: Firestore,
  userRef: FirebaseFirestore.DocumentReference
) {
  const snap = await userRef.get();
  const stats = snap.data()?.referralStats;
  if (stats?.levels?.length === REFERRAL_RATES.length) return;

  await userRef.set(
    { referralStats: normalizeReferralStats(stats) },
    { merge: true }
  );
}

/** Credit uplines when a downline subscribes to a bot (not on deposit). */
export async function applyReferralCommissions(
  db: Firestore,
  subscriberUid: string,
  amount: number
) {
  const userSnap = await db.collection("users").doc(subscriberUid).get();
  if (!userSnap.exists) return;

  let uplineUid: string | null = userSnap.data()?.referredBy ?? null;
  if (!uplineUid) return;

  const commissions = calculateReferralCommissions(amount);

  for (let level = 0; level < REFERRAL_RATES.length && uplineUid; level++) {
    const referrerUid: string = uplineUid;
    const commission = commissions[level];
    const referrerRef = db.collection("users").doc(referrerUid);
    const referrerSnap = await referrerRef.get();
    if (!referrerSnap.exists) break;

    await ensureReferralStatsStructure(db, referrerRef);

    await db.runTransaction(async (tx) => {
      tx.update(referrerRef, {
        walletBalance: FieldValue.increment(commission),
        "referralStats.totalEarned": FieldValue.increment(commission),
        [`referralStats.levels.${level}.invested`]: FieldValue.increment(amount),
        [`referralStats.levels.${level}.earned`]: FieldValue.increment(commission),
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
          investmentAmount: amount,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    uplineUid = (referrerSnap.data()?.referredBy as string | undefined) ?? null;
  }
}

/** Increment member counts up the chain when a new user signs up with a referral. */
export async function trackReferralSignup(
  db: Firestore,
  newUserUid: string
) {
  const userRef = db.collection("users").doc(newUserUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists || userSnap.data()?.referralNetworkTracked) return;

  let uplineUid: string | null = userSnap.data()?.referredBy ?? null;
  if (!uplineUid) {
    await userRef.update({ referralNetworkTracked: true });
    return;
  }

  for (let level = 0; level < REFERRAL_RATES.length && uplineUid; level++) {
    const referrerUid: string = uplineUid;
    const uplineRef = db.collection("users").doc(referrerUid);
    const uplineSnap = await uplineRef.get();
    if (!uplineSnap.exists) break;

    await ensureReferralStatsStructure(db, uplineRef);

    await uplineRef.update({
      [`referralStats.levels.${level}.members`]: FieldValue.increment(1),
    });

    uplineUid = (uplineSnap.data()?.referredBy as string | undefined) ?? null;
  }

  await userRef.update({ referralNetworkTracked: true });
}

export function defaultReferralStatsForNewUser() {
  return createEmptyReferralStats();
}
