"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fulfillPaidDeposit = fulfillPaidDeposit;
const firestore_1 = require("firebase-admin/firestore");
async function fulfillPaidDeposit(db, intentId, depositId, expectedUserId) {
    var _a, _b, _c;
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
            .limit(5)
            .get();
        depositDoc =
            (_c = depositSnap.docs.find((doc) => doc.data().status === "pending")) !== null && _c !== void 0 ? _c : null;
        if (!depositDoc)
            return false;
    }
    const deposit = depositDoc.data();
    const userId = deposit.userId;
    if (expectedUserId && userId !== expectedUserId) {
        return false;
    }
    const amount = deposit.amount;
    const resolvedDepositId = depositDoc.id;
    const depositRef = depositDoc.ref;
    const credited = await db.runTransaction(async (tx) => {
        var _a;
        const freshDeposit = await tx.get(depositRef);
        if (!freshDeposit.exists || ((_a = freshDeposit.data()) === null || _a === void 0 ? void 0 : _a.status) !== "pending") {
            return false;
        }
        const userRef = db.collection("users").doc(userId);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists)
            return false;
        tx.update(depositRef, { status: "paid" });
        tx.update(userRef, {
            walletBalance: firestore_1.FieldValue.increment(amount),
            totalDeposited: firestore_1.FieldValue.increment(amount),
        });
        return true;
    });
    if (!credited)
        return false;
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