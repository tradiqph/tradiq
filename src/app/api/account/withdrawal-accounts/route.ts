import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  getAccountTypeConfig,
  normalizeAccountNumber,
  validateWithdrawalAccount,
  WITHDRAWAL_ACCOUNT_TYPES,
} from "@/lib/withdrawal-accounts";

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { label, accountType, accountNumber, accountName, bankName } =
    await request.json();
  if (!label || !accountType || !accountNumber || !accountName) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  const validType = WITHDRAWAL_ACCOUNT_TYPES.some((t) => t.value === accountType);
  if (!validType) {
    return NextResponse.json({ error: "Invalid account type" }, { status: 400 });
  }

  const normalizedNumber = normalizeAccountNumber(accountNumber);
  const validationError = validateWithdrawalAccount({
    accountType,
    accountNumber: normalizedNumber,
    bankName,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const accountsRef = db
    .collection("users")
    .doc(decoded.uid)
    .collection("withdrawalAccounts");

  const existing = await accountsRef.get();
  if (existing.size >= 3) {
    return NextResponse.json({ error: "Maximum 3 accounts" }, { status: 400 });
  }

  const config = getAccountTypeConfig(accountType);
  const payload: Record<string, unknown> = {
    label: String(label).trim(),
    accountType,
    accountNumber: normalizedNumber,
    accountName: String(accountName).trim(),
    createdAt: FieldValue.serverTimestamp(),
  };

  if (config?.requiresBank && bankName) {
    payload.bankName = String(bankName).trim();
  }

  const doc = await accountsRef.add(payload);

  return NextResponse.json({ id: doc.id });
}
