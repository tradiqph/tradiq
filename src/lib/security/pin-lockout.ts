import {
  FieldValue,
  Firestore,
  Timestamp,
} from "firebase-admin/firestore";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export function getPinLockoutMessage(
  lockedUntil: FirebaseFirestore.Timestamp | null | undefined
): string | null {
  if (!lockedUntil) return null;
  const untilMs = lockedUntil.toMillis();
  if (untilMs <= Date.now()) return null;
  const mins = Math.ceil((untilMs - Date.now()) / 60_000);
  return `Too many failed PIN attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}

export async function recordPinFailure(
  db: Firestore,
  userRef: FirebaseFirestore.DocumentReference
): Promise<void> {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return;

    const attempts = (snap.data()?.pinFailedAttempts as number | undefined) ?? 0;
    const next = attempts + 1;

    if (next >= MAX_FAILED_ATTEMPTS) {
      tx.update(userRef, {
        pinFailedAttempts: 0,
        pinLockedUntil: Timestamp.fromMillis(Date.now() + LOCKOUT_MS),
      });
      return;
    }

    tx.update(userRef, { pinFailedAttempts: next });
  });
}

export async function clearPinFailures(
  userRef: FirebaseFirestore.DocumentReference
): Promise<void> {
  await userRef.update({
    pinFailedAttempts: FieldValue.delete(),
    pinLockedUntil: FieldValue.delete(),
  });
}
