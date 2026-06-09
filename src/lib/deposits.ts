import {
  collection,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export interface CreateDepositPayload {
  depositId: string;
  userId: string;
  amount: number;
  intentId: string;
  qrImageUrl: string;
}

export async function persistDepositOnClient({
  depositId,
  userId,
  amount,
  intentId,
  qrImageUrl,
}: CreateDepositPayload) {
  const firestore = db;
  if (!firestore) throw new Error("Firebase not configured");

  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000));

  await setDoc(doc(firestore, "deposits", depositId), {
    userId,
    amount,
    paymongoIntentId: intentId,
    status: "pending",
    qrImageUrl,
    expiresAt,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(firestore, "users", userId, "transactions", depositId), {
    type: "deposit",
    amount,
    status: "pending",
    metadata: { paymongoIntentId: intentId, depositId },
    title: "Deposit",
    subtitle: "QR Ph — Pending payment",
    createdAt: serverTimestamp(),
  });
}

export async function fulfillDepositOnClient({
  depositId,
  userId,
}: {
  depositId: string;
  userId: string;
}) {
  const firestore = db;
  if (!firestore) throw new Error("Firebase not configured");

  const configSnap = await getDoc(doc(firestore, "appConfig", "platform"));
  if (!configSnap.data()?.enableTestDepositFulfillment) {
    throw new Error("Local deposit fulfillment is not enabled");
  }

  await runTransaction(firestore, async (tx) => {
    const depositRef = doc(firestore, "deposits", depositId);
    const userRef = doc(firestore, "users", userId);
    const transactionRef = doc(firestore, "users", userId, "transactions", depositId);

    const depositSnap = await tx.get(depositRef);
    if (!depositSnap.exists()) {
      throw new Error("Deposit not found");
    }

    const deposit = depositSnap.data();
    if (deposit.userId !== userId) {
      throw new Error("Unauthorized deposit");
    }
    if (deposit.status !== "pending") {
      return;
    }

    const amount = deposit.amount as number;
    tx.update(depositRef, { status: "paid" });
    tx.update(userRef, {
      walletBalance: increment(amount),
      totalDeposited: increment(amount),
    });
    tx.update(transactionRef, {
      status: "paid",
      subtitle: "QR Ph — Paid",
    });
  });
}
