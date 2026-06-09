import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { amount, accountId, pin } = await request.json();
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

  await db.collection("withdrawalRequests").add({
    userId: decoded.uid,
    userEmail: userData.email,
    amount: num,
    accountSnapshot: accountSnap.data(),
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  });

  await userRef.collection("transactions").add({
    type: "withdrawal",
    amount: num,
    status: "pending",
    title: "Withdrawal",
    subtitle: "Pending admin approval",
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true });
}
