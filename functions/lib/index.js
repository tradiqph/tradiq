"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyBotEarnings = exports.fulfillDeposit = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const deposit_fulfillment_1 = require("./deposit-fulfillment");
(0, app_1.initializeApp)();
const PAYMONGO_API = "https://api.paymongo.com/v1";
async function getPaymentIntentStatus(intentId, secretKey) {
    const auth = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
    const res = await fetch(`${PAYMONGO_API}/payment_intents/${intentId}`, {
        headers: { Authorization: auth },
    });
    if (!res.ok) {
        throw new Error("Failed to verify payment intent");
    }
    const data = await res.json();
    return data.data.attributes.status;
}
exports.fulfillDeposit = (0, https_1.onRequest)({
    region: "asia-southeast1",
    cors: true,
}, async (req, res) => {
    var _a;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    const authHeader = req.headers.authorization;
    if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith("Bearer "))) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const decoded = await (0, auth_1.getAuth)().verifyIdToken(authHeader.slice(7));
        const { intentId, depositId } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
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
        const db = (0, firestore_1.getFirestore)();
        const synced = await (0, deposit_fulfillment_1.fulfillPaidDeposit)(db, intentId, typeof depositId === "string" ? depositId : undefined);
        if (!synced) {
            res.status(404).json({
                error: "Pending deposit not found",
                intentStatus,
                synced: false,
            });
            return;
        }
        res.json({ intentStatus, synced: true, paid: true });
    }
    catch (e) {
        res.status(500).json({
            error: e instanceof Error ? e.message : "Fulfillment failed",
            synced: false,
        });
    }
});
const DAILY_BOT_RATE = 0.03;
const BOT_TERM_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function toDate(value) {
    if (!value)
        return null;
    if (value instanceof Date)
        return value;
    if (typeof value.toDate === "function") {
        return value.toDate();
    }
    if (typeof value.seconds === "number") {
        return new Date(value.seconds * 1000);
    }
    return null;
}
function inferDaysAccrued(bot) {
    var _a, _b;
    if (typeof bot.daysAccrued === "number")
        return bot.daysAccrued;
    const amount = bot.amount;
    const totalAccrued = (_a = bot.totalAccrued) !== null && _a !== void 0 ? _a : 0;
    if (!amount || !totalAccrued)
        return 0;
    const perDay = Math.round(amount * DAILY_BOT_RATE * 100) / 100;
    if (perDay <= 0)
        return 0;
    const termDays = (_b = bot.termDays) !== null && _b !== void 0 ? _b : BOT_TERM_DAYS;
    return Math.min(termDays, Math.round(totalAccrued / perDay));
}
function isDueForAccrual(bot, now) {
    var _a;
    if (bot.status !== "active")
        return false;
    const daysAccrued = inferDaysAccrued(bot);
    const termDays = (_a = bot.termDays) !== null && _a !== void 0 ? _a : BOT_TERM_DAYS;
    if (daysAccrued >= termDays)
        return false;
    const subscribedAt = toDate(bot.subscribedAt);
    if (!subscribedAt)
        return false;
    const lastAccruedAt = toDate(bot.lastAccruedAt);
    const anchor = lastAccruedAt !== null && lastAccruedAt !== void 0 ? lastAccruedAt : subscribedAt;
    return now.getTime() - anchor.getTime() >= MS_PER_DAY;
}
exports.dailyBotEarnings = (0, scheduler_1.onSchedule)({
    schedule: "0 0 * * *",
    timeZone: "Asia/Manila",
}, async () => {
    var _a, _b;
    const db = (0, firestore_1.getFirestore)();
    const now = new Date();
    const botsSnap = await db
        .collectionGroup("bots")
        .where("status", "==", "active")
        .get();
    for (const botDoc of botsSnap.docs) {
        const bot = botDoc.data();
        if (!isDueForAccrual(bot, now))
            continue;
        const userRef = botDoc.ref.parent.parent;
        if (!userRef)
            continue;
        const amount = bot.amount;
        const rate = (_a = bot.dailyRate) !== null && _a !== void 0 ? _a : DAILY_BOT_RATE;
        const earning = Math.round(amount * rate * 100) / 100;
        if (earning <= 0)
            continue;
        const daysAccrued = inferDaysAccrued(bot);
        const termDays = (_b = bot.termDays) !== null && _b !== void 0 ? _b : BOT_TERM_DAYS;
        const newDaysAccrued = daysAccrued + 1;
        const isComplete = newDaysAccrued >= termDays;
        await db.runTransaction(async (tx) => {
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists)
                return;
            let walletIncrement = earning;
            if (isComplete) {
                walletIncrement += amount;
            }
            tx.update(userRef, {
                walletBalance: firestore_1.FieldValue.increment(walletIncrement),
                totalEarnings: firestore_1.FieldValue.increment(earning),
            });
            tx.update(botDoc.ref, Object.assign({ totalAccrued: firestore_1.FieldValue.increment(earning), daysAccrued: newDaysAccrued, lastAccruedAt: firestore_1.FieldValue.serverTimestamp() }, (isComplete ? { status: "completed" } : {})));
            tx.set(userRef.collection("transactions").doc(), {
                type: "earning",
                amount: earning,
                status: "paid",
                title: isComplete ? "Final Bot Earnings" : "Daily Bot Earnings",
                subtitle: isComplete
                    ? "3% daily return — term complete"
                    : "3% daily return",
                metadata: { botId: botDoc.id, day: newDaysAccrued },
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
            if (isComplete) {
                tx.set(userRef.collection("transactions").doc(), {
                    type: "earning",
                    amount,
                    status: "paid",
                    title: "Principal Returned",
                    subtitle: "Bot investment completed — principal to wallet",
                    metadata: { botId: botDoc.id },
                    createdAt: firestore_1.FieldValue.serverTimestamp(),
                });
            }
        });
    }
});
//# sourceMappingURL=index.js.map