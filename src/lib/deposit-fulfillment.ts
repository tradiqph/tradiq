import { FieldValue, Firestore } from "firebase-admin/firestore";

export async function fulfillPaidDeposit(
  db: Firestore,
  intentId: string,
  depositId?: string
) {
  let depositDoc = null;

  if (depositId) {
    const direct = await db.collection("deposits").doc(depositId).get();
    if (
      direct.exists &&
      direct.data()?.paymongoIntentId === intentId &&
      direct.data()?.status === "pending"
    ) {
      depositDoc = direct;
    }
  }

  if (!depositDoc) {
    const depositSnap = await db
      .collection("deposits")
      .where("paymongoIntentId", "==", intentId)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (depositSnap.empty) return false;
    depositDoc = depositSnap.docs[0];
  }

  const deposit = depositDoc.data()!;
  const userId = deposit.userId as string;
  const amount = deposit.amount as number;
  const resolvedDepositId = depositDoc.id;

  await db.runTransaction(async (tx) => {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return;

    tx.update(depositDoc!.ref, { status: "paid" });
    tx.update(userRef, {
      walletBalance: FieldValue.increment(amount),
      totalDeposited: FieldValue.increment(amount),
    });
  });

  const txRef = db
    .collection("users")
    .doc(userId)
    .collection("transactions")
    .doc(resolvedDepositId);

  const txDoc = await txRef.get();
  if (txDoc.exists) {
    await txRef.update({
      status: "paid",
      subtitle: "QR Ph — Paid",
    });
    return true;
  }

  const txByIntent = await db
    .collection("users")
    .doc(userId)
    .collection("transactions")
    .where("metadata.paymongoIntentId", "==", intentId)
    .limit(1)
    .get();

  if (!txByIntent.empty) {
    await txByIntent.docs[0].ref.update({
      status: "paid",
      subtitle: "QR Ph — Paid",
    });
    return true;
  }

  const txByDeposit = await db
    .collection("users")
    .doc(userId)
    .collection("transactions")
    .where("metadata.depositId", "==", resolvedDepositId)
    .limit(1)
    .get();

  if (!txByDeposit.empty) {
    await txByDeposit.docs[0].ref.update({
      status: "paid",
      subtitle: "QR Ph — Paid",
    });
  }

  return true;
}
