import { Firestore } from "firebase-admin/firestore";
import { enrichBotInvestment, type BotInvestmentData } from "@/lib/investments";
import { fetchAllUserBots, type BotDocRef } from "@/lib/console/fetch-bots";
import type { ConsoleBotInvestment } from "@/lib/console/investments-group";

function botRefKey(ref: BotDocRef): string {
  return `${ref.userId}:${ref.botId}`;
}

/** Presentation-only: member investments + logged-in super admin's own bots. */
export async function fetchLiveActivityInvestments(
  db: Firestore,
  callerUid: string
): Promise<ConsoleBotInvestment[]> {
  const memberBots = await fetchAllUserBots(db, undefined, true);

  const callerBotsSnap = await db
    .collection("users")
    .doc(callerUid)
    .collection("bots")
    .get();

  const callerBots: BotDocRef[] = callerBotsSnap.docs.map((doc) => ({
    userId: callerUid,
    botId: doc.id,
    data: doc.data() as BotInvestmentData,
  }));

  const seen = new Set<string>();
  const merged: BotDocRef[] = [];
  for (const ref of [...memberBots, ...callerBots]) {
    const key = botRefKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(ref);
  }

  const userIds = [...new Set(merged.map((b) => b.userId))];
  const userMap = new Map<string, { email: string; displayName: string }>();

  await Promise.all(
    userIds.map(async (uid) => {
      const snap = await db.collection("users").doc(uid).get();
      if (snap.exists) {
        const d = snap.data()!;
        userMap.set(uid, {
          email: d.email ?? "",
          displayName: d.displayName ?? "",
        });
      }
    })
  );

  return merged
    .map(({ userId, botId, data }) =>
      enrichBotInvestment(data, userId, botId, userMap.get(userId))
    )
    .sort((a, b) => (b.subscribedAt ?? "").localeCompare(a.subscribedAt ?? ""));
}
