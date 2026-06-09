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

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { amount, accountId, pin } = await request.json();

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ withdrawLocally: true });
  }
  const num = Number(amount);
  const amountError = validateWithdrawalAmount(num);
  if (amountError) {
    return NextResponse.json({ error: amountError }, { status: 400 });
  }

  const userRef = db.collection("users").doc(decoded.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userData = userSnap.data()!;

  if (userData.securityPinHash) {
    if (!pin) {
      return NextResponse.json({ error: "PIN required" }, { status: 400 });
    }
    const valid = await bcrypt.compare(pin, userData.securityPinHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 403 });
    }
  }

  if ((userData.walletBalance ?? 0) < num) {
    return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
  }

  const accountSnap = await userRef
    .collection("withdrawalAccounts")
    .doc(accountId)
    .get();

  if (!accountSnap.exists) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const { processingFee, netPayout } = calculateWithdrawalBreakdown(num);
  const requestRef = db.collection("withdrawalRequests").doc();

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
}
