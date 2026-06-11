"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOT_TERM_DAYS = exports.DAILY_BOT_RATE = void 0;
exports.toDate = toDate;
exports.inferDaysAccrued = inferDaysAccrued;
exports.isDueForAccrual = isDueForAccrual;
exports.processOneBotAccrual = processOneBotAccrual;
exports.recordAccrualRun = recordAccrualRun;
exports.runBotAccrualBatch = runBotAccrualBatch;
const firestore_1 = require("firebase-admin/firestore");
exports.DAILY_BOT_RATE = 0.03;
exports.BOT_TERM_DAYS = 30;
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
    const perDay = Math.round(amount * exports.DAILY_BOT_RATE * 100) / 100;
    if (perDay <= 0)
        return 0;
    const termDays = (_b = bot.termDays) !== null && _b !== void 0 ? _b : exports.BOT_TERM_DAYS;
    return Math.min(termDays, Math.round(totalAccrued / perDay));
}
function isDueForAccrual(bot, now) {
    var _a;
    if (bot.status !== "active")
        return false;
    const daysAccrued = inferDaysAccrued(bot);
    const termDays = (_a = bot.termDays) !== null && _a !== void 0 ? _a : exports.BOT_TERM_DAYS;
    if (daysAccrued >= termDays)
        return false;
    const subscribedAt = toDate(bot.subscribedAt);
    if (!subscribedAt)
        return false;
    const lastAccruedAt = toDate(bot.lastAccruedAt);
    const anchor = lastAccruedAt !== null && lastAccruedAt !== void 0 ? lastAccruedAt : subscribedAt;
    return now.getTime() - anchor.getTime() >= MS_PER_DAY;
}
/** Credit exactly one day of bot interest (and principal on final day). */
async function processOneBotAccrual(db, botDocRef, now) {
    var _a, _b;
    const botId = botDocRef.id;
    const userRef = botDocRef.parent.parent;
    if (!userRef) {
        return { processed: false, botId, reason: "missing_user_ref" };
    }
    const userId = userRef.id;
    const preSnap = await botDocRef.get();
    if (!preSnap.exists) {
        return { processed: false, botId, userId, reason: "bot_not_found" };
    }
    const preBot = preSnap.data();
    if (!isDueForAccrual(preBot, now)) {
        return { processed: false, botId, userId, reason: "not_due" };
    }
    const amount = preBot.amount;
    const rate = (_a = preBot.dailyRate) !== null && _a !== void 0 ? _a : exports.DAILY_BOT_RATE;
    const earning = Math.round(amount * rate * 100) / 100;
    if (earning <= 0) {
        return { processed: false, botId, userId, reason: "zero_earning" };
    }
    const daysAccrued = inferDaysAccrued(preBot);
    const termDays = (_b = preBot.termDays) !== null && _b !== void 0 ? _b : exports.BOT_TERM_DAYS;
    const newDaysAccrued = daysAccrued + 1;
    const isComplete = newDaysAccrued >= termDays;
    let credited = false;
    await db.runTransaction(async (tx) => {
        var _a;
        const botSnap = await tx.get(botDocRef);
        if (!botSnap.exists)
            return;
        const bot = botSnap.data();
        if (!isDueForAccrual(bot, now))
            return;
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists)
            return;
        const freshDaysAccrued = inferDaysAccrued(bot);
        const freshTermDays = (_a = bot.termDays) !== null && _a !== void 0 ? _a : exports.BOT_TERM_DAYS;
        const nextDaysAccrued = freshDaysAccrued + 1;
        const complete = nextDaysAccrued >= freshTermDays;
        let walletIncrement = earning;
        if (complete) {
            walletIncrement += amount;
        }
        tx.update(userRef, {
            walletBalance: firestore_1.FieldValue.increment(walletIncrement),
            totalEarnings: firestore_1.FieldValue.increment(earning),
        });
        tx.update(botDocRef, Object.assign({ totalAccrued: firestore_1.FieldValue.increment(earning), daysAccrued: nextDaysAccrued, lastAccruedAt: firestore_1.FieldValue.serverTimestamp() }, (complete ? { status: "completed" } : {})));
        tx.set(userRef.collection("transactions").doc(), {
            type: "earning",
            amount: earning,
            status: "paid",
            title: complete ? "Final Bot Earnings" : "Daily Bot Earnings",
            subtitle: complete
                ? "3% daily return — term complete"
                : "3% daily return",
            metadata: { botId, day: nextDaysAccrued },
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        if (complete) {
            tx.set(userRef.collection("transactions").doc(), {
                type: "earning",
                amount,
                status: "paid",
                title: "Principal Returned",
                subtitle: "Bot investment completed — principal to wallet",
                metadata: { botId },
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        credited = true;
    });
    if (!credited) {
        return { processed: false, botId, userId, reason: "transaction_skipped" };
    }
    return {
        processed: true,
        botId,
        userId,
        earning,
        newDaysAccrued,
        completed: isComplete,
    };
}
/** Ops visibility for console — server writes only. */
async function recordAccrualRun(db, summary, source) {
    await db.collection("platform").doc("accrual").set({
        lastRunAt: firestore_1.FieldValue.serverTimestamp(),
        dueCount: summary.dueCount,
        processedCount: summary.processedCount,
        source,
    }, { merge: true });
}
/** Process at most one accrual per due active bot. */
async function runBotAccrualBatch(db, now = new Date()) {
    const botsSnap = await db
        .collectionGroup("bots")
        .where("status", "==", "active")
        .get();
    const results = [];
    let dueCount = 0;
    let processedCount = 0;
    for (const botDoc of botsSnap.docs) {
        const bot = botDoc.data();
        if (!isDueForAccrual(bot, now))
            continue;
        dueCount += 1;
        const result = await processOneBotAccrual(db, botDoc.ref, now);
        results.push(result);
        if (result.processed)
            processedCount += 1;
    }
    return { dueCount, processedCount, results };
}
//# sourceMappingURL=bot-accrual.js.map