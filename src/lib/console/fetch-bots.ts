import { Firestore } from "firebase-admin/firestore";
import { type BotInvestmentData } from "@/lib/investments";

export interface BotDocRef {
  userId: string;
  botId: string;
  data: BotInvestmentData;
}

/** Iterate users/{uid}/bots — works without a collectionGroup index. */
export async function fetchAllUserBots(
  db: Firestore,
  status?: "active" | "completed"
): Promise<BotDocRef[]> {
  const usersSnap = await db.collection("users").get();
  const results: BotDocRef[] = [];

  await Promise.all(
    usersSnap.docs.map(async (userDoc) => {
      const botsSnap = await userDoc.ref.collection("bots").get();
      for (const botDoc of botsSnap.docs) {
        const data = botDoc.data() as BotInvestmentData;
        if (status && data.status !== status) continue;
        results.push({
          userId: userDoc.id,
          botId: botDoc.id,
          data,
        });
      }
    })
  );

  return results;
}
