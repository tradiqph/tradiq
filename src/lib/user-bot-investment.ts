import type { Firestore } from "firebase-admin/firestore";

export async function userHasBotInvestment(
  db: Firestore,
  userId: string
): Promise<boolean> {
  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("bots")
    .limit(1)
    .get();

  return !snap.empty;
}
