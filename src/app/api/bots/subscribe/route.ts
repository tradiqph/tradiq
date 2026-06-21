import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/api-auth";
import { validateBotSubscribeAmount, DAILY_BOT_RATE } from "@/lib/finance";
import { getAdminDb } from "@/lib/firebase/admin";
import { BOT_TERM_DAYS } from "@/lib/investments";
import { applyReferralCommissions } from "@/lib/referral-payout";
import { sendBotInvestmentAlert } from "@/lib/email/send";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import { isProduction } from "@/lib/security/env";
import {
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    if (isProduction()) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 503 }
      );
    }
    return NextResponse.json({ subscribeLocally: true });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit({
    scope: "bots-subscribe",
    key: `${decoded.uid}:${ip}`,
    limit: 10,
    windowSec: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many subscription attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiBadRequest("Invalid JSON body");
  }

  const amount =
    typeof body === "object" && body !== null && "amount" in body
      ? Number((body as { amount: unknown }).amount)
      : NaN;

  const amountError = validateBotSubscribeAmount(amount);
  if (amountError) {
    return apiBadRequest(amountError);
  }

  const userRef = db.collection("users").doc(decoded.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userData = userSnap.data()!;
  if ((userData.walletBalance ?? 0) < amount) {
    return NextResponse.json(
      { error: "Insufficient wallet balance" },
      { status: 400 }
    );
  }

  let newBotId: string | null = null;
  let activeBotCount: number | undefined;

  try {
    await db.runTransaction(async (tx) => {
      const freshUser = await tx.get(userRef);
      const balance = freshUser.data()?.walletBalance ?? 0;
      if (balance < amount) throw new Error("Insufficient balance");

      tx.update(userRef, {
        walletBalance: FieldValue.increment(-amount),
      });

      const botRef = userRef.collection("bots").doc();
      newBotId = botRef.id;
      tx.set(botRef, {
        amount,
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
        amount,
        status: "paid",
        title: "Copy Trading Bot",
        subtitle: "Bot subscription activated",
        metadata: { botId: botRef.id },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    await applyReferralCommissions(db, decoded.uid, amount, {
      botId: newBotId ?? undefined,
    });

    try {
      const botsSnap = await userRef.collection("bots").get();
      activeBotCount = botsSnap.docs.filter(
        (doc) => doc.data().status === "active"
      ).length;
    } catch (countErr) {
      console.warn("[bots/subscribe] active bot count skipped:", countErr);
    }

    try {
      const notifyResult = await sendBotInvestmentAlert({
        db,
        memberId: decoded.uid,
        memberName:
          (userData.displayName as string | undefined)?.trim() ||
          userData.email ||
          "Member",
        memberEmail: (userData.email as string) ?? decoded.email ?? "unknown",
        amount,
        investedAt: new Date(),
        botId: newBotId ?? undefined,
        activeBotCount,
      });
      if (!notifyResult.ok) {
        console.warn(
          "[bots/subscribe] admin notification not sent:",
          notifyResult.error
        );
      } else {
        console.info(
          `[bots/subscribe] admin notification sent id=${notifyResult.id ?? "unknown"}`
        );
      }
    } catch (notifyErr) {
      console.warn("[bots/subscribe] admin notification failed:", notifyErr);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message === "Insufficient balance") {
      return NextResponse.json(
        { error: "Insufficient wallet balance" },
        { status: 400 }
      );
    }
    return apiError("bots/subscribe", e, 500, "Failed to subscribe to bot");
  }
}
