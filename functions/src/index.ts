import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { fulfillPaidDeposit } from "./deposit-fulfillment";
import { runBotAccrualBatch } from "./bot-accrual";

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

/** Bot accrual — credits 3% per bot after each 24h cycle (max one accrual per bot per run). */
export const dailyBotEarnings = onSchedule(
  {
    schedule: "*/15 * * * *",
    timeZone: "Asia/Manila",
    region: "asia-southeast1",
  },
  async () => {
    const db = getFirestore();
    const summary = await runBotAccrualBatch(db);
    console.log(
      `[dailyBotEarnings] due=${summary.dueCount} processed=${summary.processedCount}`
    );
  }
);
