import bcrypt from "bcryptjs";
import {
  collection,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  calculateWithdrawalBreakdown,
  validateWithdrawalAmount,
  WITHDRAWAL_PROCESSING_FEE_RATE,
} from "@/lib/finance";
import { WithdrawalAccount } from "@/types";

async function clientWithdrawalEnabled() {
  const firestore = db;
  if (!firestore) return false;
  const configSnap = await getDoc(doc(firestore, "appConfig", "platform"));
  const data = configSnap.data();
  return Boolean(
    data?.enableClientWithdrawals ??
      data?.enableClientBotSubscribe ??
      data?.enableTestDepositFulfillment
  );
}

export async function createWithdrawalOnClient({
  userId,
  userEmail,
  amount,
  accountSnapshot,
  securityPinHash,
  pin,
}: {
  userId: string;
  userEmail: string;
  amount: number;
  accountSnapshot: WithdrawalAccount;
  securityPinHash: string | null;
  pin?: string;
}) {
  const firestore = db;
  if (!firestore) throw new Error("Firebase not configured");
  const amountError = validateWithdrawalAmount(amount);
  if (amountError) throw new Error(amountError);

  const enabled = await clientWithdrawalEnabled();
  if (!enabled) {
    throw new Error(
      "Withdrawals are not enabled. Add FIREBASE_ADMIN_SERVICE_ACCOUNT on the server."
    );
  }

  if (securityPinHash) {
    if (!pin) throw new Error("PIN required");
    const valid = await bcrypt.compare(pin, securityPinHash);
    if (!valid) throw new Error("Invalid PIN");
  }

  const { processingFee, netPayout } = calculateWithdrawalBreakdown(amount);
  const requestRef = doc(collection(firestore, "withdrawalRequests"));

  await runTransaction(firestore, async (tx) => {
    const userRef = doc(firestore, "users", userId);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found");

    const balance = userSnap.data()?.walletBalance ?? 0;
    if (balance < amount) throw new Error("Insufficient wallet balance");

    tx.update(userRef, {
      walletBalance: increment(-amount),
    });

    tx.set(requestRef, {
      userId,
      userEmail,
      amount,
      processingFee,
      processingFeeRate: WITHDRAWAL_PROCESSING_FEE_RATE,
      netPayout,
      accountSnapshot,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    tx.set(doc(collection(firestore, "users", userId, "transactions")), {
      type: "withdrawal",
      amount,
      status: "pending",
      title: "Withdrawal",
      subtitle: `Pending · ₱${netPayout.toLocaleString("en-PH", { minimumFractionDigits: 2 })} after 4% fee`,
      metadata: {
        withdrawalRequestId: requestRef.id,
        processingFee,
        netPayout,
      },
      createdAt: serverTimestamp(),
    });
  });

  return requestRef.id;
}
