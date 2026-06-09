import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { DAILY_BOT_RATE } from "@/lib/finance";
import { BOT_TERM_DAYS } from "@/lib/investments";
import { applyReferralCommissions } from "@/lib/referral-payout";

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

  await applyReferralCommissions(db, decoded.uid, num);

  return NextResponse.json({ success: true });
}
