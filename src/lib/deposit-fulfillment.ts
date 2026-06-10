import { FieldValue, Firestore } from "firebase-admin/firestore";

export async function fulfillPaidDeposit(
  db: Firestore,
  intentId: string,
  depositId?: string,
  expectedUserId?: string
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
      .limit(5)
      .get();

    depositDoc =
      depositSnap.docs.find((doc) => doc.data().status === "pending") ?? null;

    if (!depositDoc) return false;
  }

  const deposit = depositDoc.data()!;
  const userId = deposit.userId as string;

  if (expectedUserId && userId !== expectedUserId) {
    return false;
  }

  const amount = deposit.amount as number;
  const resolvedDepositId = depositDoc.id;
  const depositRef = depositDoc.ref;

  const credited = await db.runTransaction(async (tx) => {
    const freshDeposit = await tx.get(depositRef);
    if (!freshDeposit.exists || freshDeposit.data()?.status !== "pending") {
      return false;
    }

    const userRef = db.collection("users").doc(userId);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return false;

    tx.update(depositRef, { status: "paid" });
    tx.update(userRef, {
      walletBalance: FieldValue.increment(amount),
      totalDeposited: FieldValue.increment(amount),
    });
    return true;
  });

  if (!credited) return false;

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
