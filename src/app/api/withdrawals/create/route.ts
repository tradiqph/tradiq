import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { verifyAuthToken } from "@/lib/api-auth";
import {
  calculateWithdrawalBreakdown,
  validateWithdrawalAmount,
  WITHDRAWAL_PROCESSING_FEE_RATE,
} from "@/lib/finance";
import { getAdminDb } from "@/lib/firebase/admin";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import { isProduction } from "@/lib/security/env";
import {
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";
import { pinSchema } from "@/lib/security/validation";

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
    return NextResponse.json({ withdrawLocally: true });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit({
    scope: "withdrawals-create",
    key: `${decoded.uid}:${ip}`,
    limit: 5,
    windowSec: 300,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many withdrawal attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
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
      ? (body as { amount?: unknown; accountId?: unknown; pin?: unknown })
      : {};

  const num = Number(payload.amount);
  const amountError = validateWithdrawalAmount(num);
  if (amountError) {
    return apiBadRequest(amountError);
  }

  if (typeof payload.accountId !== "string" || !payload.accountId) {
    return apiBadRequest("Withdrawal account is required");
  }

  const userRef = db.collection("users").doc(decoded.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userData = userSnap.data()!;

  if (userData.securityPinHash) {
    const pinParsed = pinSchema.safeParse(payload.pin);
    if (!pinParsed.success) {
      return apiBadRequest("PIN required");
    }
    const valid = await bcrypt.compare(
      pinParsed.data,
      userData.securityPinHash
    );
    if (!valid) {
      console.warn(
        `[withdrawals/create] Invalid PIN attempt uid=${decoded.uid}`
      );
      return NextResponse.json({ error: "Invalid PIN" }, { status: 403 });
    }
  }

  if ((userData.walletBalance ?? 0) < num) {
    return NextResponse.json(
      { error: "Insufficient wallet balance" },
      { status: 400 }
    );
  }

  const accountSnap = await userRef
    .collection("withdrawalAccounts")
    .doc(payload.accountId)
    .get();

  if (!accountSnap.exists) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const { processingFee, netPayout } = calculateWithdrawalBreakdown(num);
  const requestRef = db.collection("withdrawalRequests").doc();

  try {
    await db.runTransaction(async (tx) => {
      const freshUserSnap = await tx.get(userRef);
      if (!freshUserSnap.exists) {
        throw new Error("User not found");
      }

      const balance = freshUserSnap.data()?.walletBalance ?? 0;
      if (balance < num) {
        throw new Error("Insufficient wallet balance");
      }

      tx.update(userRef, {
        walletBalance: FieldValue.increment(-num),
      });

      tx.set(requestRef, {
        userId: decoded.uid,
        userEmail: userData.email,
        amount: num,
        processingFee,
        processingFeeRate: WITHDRAWAL_PROCESSING_FEE_RATE,
        netPayout,
        accountSnapshot: accountSnap.data(),
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.set(userRef.collection("transactions").doc(), {
        type: "withdrawal",
        amount: num,
        status: "pending",
        title: "Withdrawal",
        subtitle: `Pending · ₱${netPayout.toLocaleString("en-PH", { minimumFractionDigits: 2 })} after 4% fee`,
        metadata: {
          withdrawalRequestId: requestRef.id,
          processingFee,
          netPayout,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      processingFee,
      netPayout,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (
      message === "Insufficient wallet balance" ||
      message === "User not found"
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return apiError(
      "withdrawals/create",
      e,
      500,
      "Failed to create withdrawal"
    );
  }
}
