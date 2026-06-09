import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  DAILY_BOT_RATE,
  REFERRAL_RATES,
  calculateReferralCommissions,
} from "@/lib/finance";
import { BOT_TERM_DAYS } from "@/lib/investments";

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { amount } = await request.json();

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ subscribeLocally: true });
  }
  const num = Number(amount);
  if (!num || num <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const userRef = db.collection("users").doc(decoded.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userData = userSnap.data()!;
  if ((userData.walletBalance ?? 0) < num) {
    return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
  }

  await db.runTransaction(async (tx) => {
    const freshUser = await tx.get(userRef);
    const balance = freshUser.data()?.walletBalance ?? 0;
    if (balance < num) throw new Error("Insufficient balance");

    tx.update(userRef, {
      walletBalance: FieldValue.increment(-num),
    });

    const botRef = userRef.collection("bots").doc();
    tx.set(botRef, {
      amount: num,
      status: "active",
      dailyRate: DAILY_BOT_RATE,
      subscribedAt: FieldValue.serverTimestamp(),
      lastAccruedAt: null,
      totalAccrued: 0,
      daysAccrued: 0,
      termDays: BOT_TERM_DAYS,
    });

    tx.set(userRef.collection("transactions").doc(), {
      type: "bot_subscribe",
      amount: num,
      status: "paid",
      title: "Copy Trading Bot",
      subtitle: "Bot subscription activated",
      metadata: { botId: botRef.id },
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  // Referral commissions
  const commissions = calculateReferralCommissions(num);
  let currentUid: string | null = userData.referredBy ?? null;

  for (let level = 0; level < REFERRAL_RATES.length && currentUid; level++) {
    const commission = commissions[level];
    const referrerRef = db.collection("users").doc(currentUid);
    const referrerSnap = await referrerRef.get();
    if (!referrerSnap.exists) break;

    await db.runTransaction(async (tx) => {
      tx.update(referrerRef, {
        walletBalance: FieldValue.increment(commission),
        "referralStats.totalEarned": FieldValue.increment(commission),
        ...(level === 0
          ? { "referralStats.level1": FieldValue.increment(1) }
          : { "referralStats.level2to5": FieldValue.increment(1) }),
      });

      tx.set(referrerRef.collection("transactions").doc(), {
        type: "referral",
        amount: commission,
        status: "paid",
        title: `Referral L${level + 1}`,
        subtitle: `Commission from bot subscription`,
        metadata: { level: level + 1, fromUserId: decoded.uid },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    currentUid = referrerSnap.data()?.referredBy ?? null;
  }

  return NextResponse.json({ success: true });
}
