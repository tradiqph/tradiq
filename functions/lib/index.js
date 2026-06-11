"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyBotEarnings = exports.fulfillDeposit = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const deposit_fulfillment_1 = require("./deposit-fulfillment");
const bot_accrual_1 = require("./bot-accrual");
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
const ALLOWED_ORIGINS = ((_a = process.env.ALLOWED_ORIGINS) !== null && _a !== void 0 ? _a : "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
function setCorsHeaders(req, res) {
    var _a;
    const origin = (_a = req.headers.origin) !== null && _a !== void 0 ? _a : "";
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}
exports.fulfillDeposit = (0, https_1.onRequest)({
    region: "asia-southeast1",
    cors: false,
}, async (req, res) => {
    var _a;
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
        const synced = await (0, deposit_fulfillment_1.fulfillPaidDeposit)(db, intentId, typeof depositId === "string" ? depositId : undefined, decoded.uid);
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
        console.error("[fulfillDeposit]", e);
        res.status(500).json({
            error: "Fulfillment failed",
            synced: false,
        });
    }
});
/** Bot accrual — credits 3% per bot after each 24h cycle (max one accrual per bot per run). */
exports.dailyBotEarnings = (0, scheduler_1.onSchedule)({
    schedule: "*/15 * * * *",
    timeZone: "Asia/Manila",
    region: "asia-southeast1",
}, async () => {
    const db = (0, firestore_1.getFirestore)();
    const summary = await (0, bot_accrual_1.runBotAccrualBatch)(db);
    await (0, bot_accrual_1.recordAccrualRun)(db, summary, "scheduler");
    console.log(`[dailyBotEarnings] due=${summary.dueCount} processed=${summary.processedCount}`);
});
//# sourceMappingURL=index.js.map