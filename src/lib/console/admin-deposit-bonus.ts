import { randomUUID } from "crypto";
import { FieldValue, Firestore } from "firebase-admin/firestore";

export interface CreditMemberDepositBonusInput {
  actorUid: string;
  actorEmail: string;
  userId: string;
  amount: number;
  note?: string;
}

export async function creditMemberDepositBonus(
  db: Firestore,
  input: CreditMemberDepositBonusInput
): Promise<{ bonusId: string }> {
  const { actorUid, actorEmail, userId, amount, note } = input;
  const bonusId = randomUUID();
  const roundedAmount = Math.round(amount * 100) / 100;

  const userRef = db.collection("users").doc(userId);
  const transactionRef = userRef.collection("transactions").doc(bonusId);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new Error("User not found");
    }

    tx.set(transactionRef, {
      type: "deposit_bonus",
      amount: roundedAmount,
      status: "paid",
      title: "Deposit Bonus",
      subtitle: "Direct deposit bonus",
      metadata: {
        bonusId,
        creditedBy: actorUid,
        creditedByEmail: actorEmail,
        ...(note?.trim() ? { note: note.trim() } : {}),
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.update(userRef, {
      walletBalance: FieldValue.increment(roundedAmount),
    });
  });

  return { bonusId };
}
