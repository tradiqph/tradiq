"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyLeadershipBonus = applyLeadershipBonus;
const firestore_1 = require("firebase-admin/firestore");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LEADERSHIP_RATES = {
    leader: 0.01,
    director: 0.012,
    ambassador: 0.015,
};
function normalizeMemberRank(value) {
    if (value === "leader" || value === "director" || value === "ambassador") {
        return value;
    }
    return "member";
}
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
/** payoutIndex 1 = first payout, due 24h after subscribe. */
function getScheduledPayoutAt(subscribedAt, payoutIndex) {
    return new Date(subscribedAt.getTime() + payoutIndex * MS_PER_DAY);
}
/**
 * Daily leadership bonus for L1 uplines with an activated rank.
 * Pays on accruals scheduled on/after rankActivatedAt (including pre-existing
 * active bots). Does not backfill days before activation.
 */
async function applyLeadershipBonus(input) {
    var _a, _b;
    const { db, botOwnerUid, botId, botAmount, botSubscribedAt, accrualDay } = input;
    const ownerSnap = await db.collection("users").doc(botOwnerUid).get();
    if (!ownerSnap.exists)
        return { paid: false };
    const referredBy = (_a = ownerSnap.data()) === null || _a === void 0 ? void 0 : _a.referredBy;
    if (!referredBy)
        return { paid: false };
    const uplineSnap = await db.collection("users").doc(referredBy).get();
    if (!uplineSnap.exists)
        return { paid: false };
    const uplineData = (_b = uplineSnap.data()) !== null && _b !== void 0 ? _b : {};
    const memberRank = normalizeMemberRank(uplineData.memberRank);
    if (memberRank === "member")
        return { paid: false };
    const rankActivatedAt = toDate(uplineData.rankActivatedAt);
    if (!rankActivatedAt)
        return { paid: false };
    const accrualScheduledAt = getScheduledPayoutAt(botSubscribedAt, accrualDay);
    if (accrualScheduledAt.getTime() < rankActivatedAt.getTime()) {
        return { paid: false };
    }
    const rate = LEADERSHIP_RATES[memberRank];
    if (!rate || rate <= 0)
        return { paid: false };
    const bonus = Math.round(botAmount * rate * 100) / 100;
    if (bonus <= 0)
        return { paid: false };
    const ledgerRef = db
        .collection("leadershipBonusEvents")
        .doc(`${referredBy}_${botId}_${accrualDay}`);
    const uplineRef = db.collection("users").doc(referredBy);
    const paid = await db.runTransaction(async (tx) => {
        const existing = await tx.get(ledgerRef);
        if (existing.exists)
            return false;
        tx.set(ledgerRef, {
            uplineUid: referredBy,
            botOwnerUid,
            botId,
            day: accrualDay,
            amount: bonus,
            rate,
            memberRank,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        tx.update(uplineRef, {
            walletBalance: firestore_1.FieldValue.increment(bonus),
        });
        tx.set(uplineRef.collection("transactions").doc(), {
            type: "referral",
            amount: bonus,
            status: "paid",
            title: "Leadership Bonus",
            subtitle: "Daily bonus from Level 1 direct referral bot",
            metadata: {
                kind: "leadership_bonus",
                level: 1,
                fromUserId: botOwnerUid,
                botId,
                day: accrualDay,
                rate,
                memberRank,
            },
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return true;
    });
    return paid
        ? { paid: true, amount: bonus, uplineUid: referredBy }
        : { paid: false };
}
//# sourceMappingURL=leadership-bonus.js.map