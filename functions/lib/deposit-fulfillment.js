"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fulfillPaidDeposit = fulfillPaidDeposit;
const firestore_1 = require("firebase-admin/firestore");
async function fulfillPaidDeposit(db, intentId, depositId) {
    var _a, _b;
    let depositDoc = null;
    if (depositId) {
        const direct = await db.collection("deposits").doc(depositId).get();
        if (direct.exists &&
            ((_a = direct.data()) === null || _a === void 0 ? void 0 : _a.paymongoIntentId) === intentId &&
            ((_b = direct.data()) === null || _b === void 0 ? void 0 : _b.status) === "pending") {
            depositDoc = direct;
        }
    }
    if (!depositDoc) {
        const depositSnap = await db
            .collection("deposits")
            .where("paymongoIntentId", "==", intentId)
            .where("status", "==", "pending")
            .limit(1)
            .get();
        if (depositSnap.empty)
            return false;
        depositDoc = depositSnap.docs[0];
    }
    const deposit = depositDoc.data();
    const userId = deposit.userId;
    const amount = deposit.amount;
    const resolvedDepositId = depositDoc.id;
    await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(userId);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists)
            return;
        tx.update(depositDoc.ref, { status: "paid" });
        tx.update(userRef, {
            depositBalance: firestore_1.FieldValue.increment(amount),
            totalDeposited: firestore_1.FieldValue.increment(amount),
        });
    });
    const txRef = db
        .collection("users")
        .doc(userId)
        .collection("transactions")
        .doc(resolvedDepositId);
    const txDoc = await txRef.get();
    if (txDoc.exists) {
        await txRef.update({
            status: "paid",
            subtitle: "QR Ph — Paid",
        });
        return true;
    }
    const txByIntent = await db
        .collection("users")
        .doc(userId)
        .collection("transactions")
        .where("metadata.paymongoIntentId", "==", intentId)
        .limit(1)
        .get();
    if (!txByIntent.empty) {
        await txByIntent.docs[0].ref.update({
            status: "paid",
            subtitle: "QR Ph — Paid",
        });
    }
    return true;
}
//# sourceMappingURL=deposit-fulfillment.js.map