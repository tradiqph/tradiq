import { randomUUID } from "crypto";
import { FieldValue, Firestore } from "firebase-admin/firestore";

export interface CreditMemberCashDepositInput {
  actorUid: string;
  actorEmail: string;
  userId: string;
  amount: number;
  note?: string;
}

export async function creditMemberCashDeposit(
  db: Firestore,
  input: CreditMemberCashDepositInput
): Promise<{ depositId: string }> {
  const { actorUid, actorEmail, userId, amount, note } = input;
  const depositId = randomUUID();
  const roundedAmount = Math.round(amount * 100) / 100;
  const paymongoIntentId = `admin-cash-${depositId}`;

  const depositRef = db.collection("deposits").doc(depositId);
  const userRef = db.collection("users").doc(userId);
  const transactionRef = userRef.collection("transactions").doc(depositId);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new Error("User not found");
    }

    tx.set(depositRef, {
      userId,
      amount: roundedAmount,
      paymongoIntentId,
      status: "paid",
      source: "admin_cash",
      creditedBy: actorUid,
      creditedByEmail: actorEmail,
      ...(note?.trim() ? { note: note.trim() } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.set(transactionRef, {
      type: "deposit",
      amount: roundedAmount,
      status: "paid",
      title: "Deposit",
      subtitle: "QR Ph — Paid",
      metadata: { paymongoIntentId, depositId },
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.update(userRef, {
      walletBalance: FieldValue.increment(roundedAmount),
      totalDeposited: FieldValue.increment(roundedAmount),
    });
  });

  return { depositId };
}
