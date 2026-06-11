import {
  collection,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { DAILY_BOT_RATE, validateBotSubscribeAmount } from "@/lib/finance";
import { BOT_TERM_DAYS } from "@/lib/investments";

async function clientBotSubscribeEnabled() {
  if (!db) return false;
  const configSnap = await getDoc(doc(db, "appConfig", "platform"));
  const data = configSnap.data();
  return Boolean(
    data?.enableClientBotSubscribe ?? data?.enableTestDepositFulfillment
  );
}

export async function subscribeBotOnClient(userId: string, amount: number) {
  const firestore = db;
  if (!firestore) throw new Error("Firebase not configured");
  const amountError = validateBotSubscribeAmount(amount);
  if (amountError) throw new Error(amountError);

  const enabled = await clientBotSubscribeEnabled();
  if (!enabled) {
    throw new Error(
      "Server not configured. Add FIREBASE_ADMIN_SERVICE_ACCOUNT to .env.local."
    );
  }

  const botId = crypto.randomUUID();

  await runTransaction(firestore, async (tx) => {
    const userRef = doc(firestore, "users", userId);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found");

    const balance = userSnap.data()?.walletBalance ?? 0;
    if (balance < amount) throw new Error("Insufficient wallet balance");

    tx.update(userRef, { walletBalance: increment(-amount) });
    tx.set(doc(firestore, "users", userId, "bots", botId), {
      amount,
      status: "active",
      dailyRate: DAILY_BOT_RATE,
      subscribedAt: serverTimestamp(),
      lastAccruedAt: null,
      totalAccrued: 0,
      daysAccrued: 0,
      termDays: BOT_TERM_DAYS,
    });
    tx.set(doc(collection(firestore, "users", userId, "transactions")), {
      type: "bot_subscribe",
      amount,
      status: "paid",
      title: "Copy Trading Bot",
      subtitle: "Bot subscription activated",
      metadata: { botId },
      createdAt: serverTimestamp(),
    });
  });

  return botId;
}
