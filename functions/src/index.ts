import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { fulfillPaidDeposit } from "./deposit-fulfillment";

initializeApp();

const PAYMONGO_API = "https://api.paymongo.com/v1";

async function getPaymentIntentStatus(intentId: string, secretKey: string) {
  const auth = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
  const res = await fetch(`${PAYMONGO_API}/payment_intents/${intentId}`, {
    headers: { Authorization: auth },
  });
  if (!res.ok) {
    throw new Error("Failed to verify payment intent");
  }
  const data = await res.json();
  return data.data.attributes.status as string;
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function setCorsHeaders(req: { headers: { origin?: string } }, res: { setHeader: (k: string, v: string) => void }) {
  const origin = req.headers.origin ?? "";
  if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

export const fulfillDeposit = onRequest(
  {
    region: "asia-southeast1",
    cors: false,
  },
  async (req, res) => {
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
      const { intentId, depositId } = req.body ?? {};

      if (!intentId || typeof intentId !== "string") {
        res.status(400).json({ error: "Missing intentId" });
        return;
      }

      const secretKey = process.env.PAYMONGO_SECRET_KEY;
      if (!secretKey) {
        res.status(500).json({ error: "Paymongo not configured" });
        return;
      }

      const intentStatus = await getPaymentIntentStatus(intentId, secretKey);
      if (intentStatus !== "succeeded") {
        res.status(409).json({
          error: "Payment not completed yet",
          intentStatus,
          synced: false,
        });
        return;
      }

      const db = getFirestore();
      const synced = await fulfillPaidDeposit(
        db,
        intentId,
        typeof depositId === "string" ? depositId : undefined,
        decoded.uid
      );

      if (!synced) {
        res.status(404).json({
          error: "Pending deposit not found",
          intentStatus,
          synced: false,
        });
        return;
      }

      res.json({ intentStatus, synced: true, paid: true });
    } catch (e) {
      console.error("[fulfillDeposit]", e);
      res.status(500).json({
        error: "Fulfillment failed",
        synced: false,
      });
    }
  }
);

const DAILY_BOT_RATE = 0.03;
const BOT_TERM_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof (value as { seconds: number }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
}

function inferDaysAccrued(bot: FirebaseFirestore.DocumentData): number {
  if (typeof bot.daysAccrued === "number") return bot.daysAccrued;
  const amount = bot.amount as number;
  const totalAccrued = (bot.totalAccrued as number) ?? 0;
  if (!amount || !totalAccrued) return 0;
  const perDay = Math.round(amount * DAILY_BOT_RATE * 100) / 100;
  if (perDay <= 0) return 0;
  const termDays = (bot.termDays as number) ?? BOT_TERM_DAYS;
  return Math.min(termDays, Math.round(totalAccrued / perDay));
}

function isDueForAccrual(
  bot: FirebaseFirestore.DocumentData,
  now: Date
): boolean {
  if (bot.status !== "active") return false;

  const daysAccrued = inferDaysAccrued(bot);
  const termDays = (bot.termDays as number) ?? BOT_TERM_DAYS;
  if (daysAccrued >= termDays) return false;

  const subscribedAt = toDate(bot.subscribedAt);
  if (!subscribedAt) return false;

  const lastAccruedAt = toDate(bot.lastAccruedAt);
  const anchor = lastAccruedAt ?? subscribedAt;
  return now.getTime() - anchor.getTime() >= MS_PER_DAY;
}

export const dailyBotEarnings = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Asia/Manila",
  },
  async () => {
    const db = getFirestore();
    const now = new Date();
    const botsSnap = await db
      .collectionGroup("bots")
      .where("status", "==", "active")
      .get();

    for (const botDoc of botsSnap.docs) {
      const bot = botDoc.data();
      if (!isDueForAccrual(bot, now)) continue;

      const userRef = botDoc.ref.parent.parent;
      if (!userRef) continue;

      const amount = bot.amount as number;
      const rate = (bot.dailyRate as number) ?? DAILY_BOT_RATE;
      const earning = Math.round(amount * rate * 100) / 100;
      if (earning <= 0) continue;

      const daysAccrued = inferDaysAccrued(bot);
      const termDays = (bot.termDays as number) ?? BOT_TERM_DAYS;
      const newDaysAccrued = daysAccrued + 1;
      const isComplete = newDaysAccrued >= termDays;

      await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) return;

        let walletIncrement = earning;
        if (isComplete) {
          walletIncrement += amount;
        }

        tx.update(userRef, {
          walletBalance: FieldValue.increment(walletIncrement),
          totalEarnings: FieldValue.increment(earning),
        });

        tx.update(botDoc.ref, {
          totalAccrued: FieldValue.increment(earning),
          daysAccrued: newDaysAccrued,
          lastAccruedAt: FieldValue.serverTimestamp(),
          ...(isComplete ? { status: "completed" } : {}),
        });

        tx.set(userRef.collection("transactions").doc(), {
          type: "earning",
          amount: earning,
          status: "paid",
          title: isComplete ? "Final Bot Earnings" : "Daily Bot Earnings",
          subtitle: isComplete
            ? "3% daily return — term complete"
            : "3% daily return",
          metadata: { botId: botDoc.id, day: newDaysAccrued },
          createdAt: FieldValue.serverTimestamp(),
        });

        if (isComplete) {
          tx.set(userRef.collection("transactions").doc(), {
            type: "earning",
            amount,
            status: "paid",
            title: "Principal Returned",
            subtitle: "Bot investment completed — principal to wallet",
            metadata: { botId: botDoc.id },
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      });
    }
  }
);
