import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

const COUNTER_DOC_PATH = "_meta/rewardClaimCounter";

export function formatRewardReferenceNumber(sequence: number): string {
  return `TRQ-RWD-${String(sequence).padStart(6, "0")}`;
}

export async function allocateRewardReferenceNumber(
  db: Firestore,
  tx: Transaction
): Promise<string> {
  const counterRef = db.doc(COUNTER_DOC_PATH);
  const counterSnap = await tx.get(counterRef);
  const current = counterSnap.exists
    ? (counterSnap.data()?.sequence as number | undefined) ?? 0
    : 0;
  const next = current + 1;

  tx.set(
    counterRef,
    { sequence: next, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  return formatRewardReferenceNumber(next);
}
