import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { validateBotSubscribeAmount } from "@/lib/finance";
import { getAdminDb } from "@/lib/firebase/admin";
import { applyReferralCommissions } from "@/lib/referral-payout";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import { isProduction } from "@/lib/security/env";
import {
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";

async function verifyDevBotSubscription(
  db: FirebaseFirestore.Firestore,
  uid: string,
  botId: string,
  amount: number
): Promise<boolean> {
  const botSnap = await db
    .collection("users")
    .doc(uid)
    .collection("bots")
    .doc(botId)
    .get();

  if (!botSnap.exists) return false;

  const bot = botSnap.data()!;
  if (bot.status !== "active") return false;
  if (Number(bot.amount) !== amount) return false;

  return true;
}

/** Apply upline commissions after a client-side bot subscription (dev fallback). */
export async function POST(request: NextRequest) {
  if (isProduction()) {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit({
    scope: "referral-apply-commissions",
    key: `${decoded.uid}:${ip}`,
    limit: 5,
    windowSec: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiBadRequest("Invalid JSON body");
  }

  const payload =
    typeof body === "object" && body !== null
      ? (body as { amount?: unknown; botId?: unknown })
      : {};

  const amount = Number(payload.amount);
  const amountError = validateBotSubscribeAmount(amount);
  if (amountError) {
    return apiBadRequest(amountError);
  }

  if (typeof payload.botId !== "string" || !payload.botId.trim()) {
    return apiBadRequest("botId is required");
  }

  const botId = payload.botId.trim();
  if (botId.length > 128) {
    return apiBadRequest("Invalid botId");
  }

  const botVerified = await verifyDevBotSubscription(
    db,
    decoded.uid,
    botId,
    amount
  );
  if (!botVerified) {
    return apiBadRequest("Active bot subscription not found for this amount");
  }

  try {
    await applyReferralCommissions(db, decoded.uid, amount, { botId });
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(
      "referral/apply-commissions",
      e,
      500,
      "Failed to apply referral commissions"
    );
  }
}
