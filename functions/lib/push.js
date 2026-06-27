"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyEarningPushMessage = dailyEarningPushMessage;
exports.finalEarningPushMessage = finalEarningPushMessage;
exports.principalReturnPushMessage = principalReturnPushMessage;
exports.sendUserPush = sendUserPush;
exports.saveUserPushToken = saveUserPushToken;
const crypto_1 = require("crypto");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
function formatPeso(amount) {
    return `₱${amount.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}
function signedAmount(amount) {
    return `+${formatPeso(amount)}`;
}
function dailyEarningPushMessage(amount) {
    return {
        title: "Daily earnings credited",
        body: `${signedAmount(amount)} from your bot subscription was added to your Wallet Balance.`,
        url: "/history",
        tag: "daily-earning",
    };
}
function finalEarningPushMessage(amount) {
    return {
        title: "Final earnings credited",
        body: `${signedAmount(amount)} from your bot subscription was added to your Wallet Balance.`,
        url: "/history",
        tag: "final-earning",
    };
}
function principalReturnPushMessage(amount) {
    return {
        title: "Principal returned",
        body: `${signedAmount(amount)} principal from your completed bot subscription was added to your Wallet Balance.`,
        url: "/history",
        tag: "principal-return",
    };
}
function tokenDocId(token) {
    return (0, crypto_1.createHash)("sha256").update(token).digest("hex").slice(0, 32);
}
async function isPushEnabledForUser(db, userId) {
    var _a;
    const snap = await db.collection("users").doc(userId).get();
    if (!snap.exists)
        return false;
    return ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.pushNotificationsEnabled) === true;
}
async function listUserPushTokens(db, userId) {
    const snap = await db
        .collection("users")
        .doc(userId)
        .collection("pushTokens")
        .get();
    return snap.docs
        .map((doc) => doc.data().token)
        .filter((token) => typeof token === "string" && token.length > 0);
}
async function removeInvalidTokens(db, userId, tokens) {
    if (tokens.length === 0)
        return;
    const batch = db.batch();
    for (const token of tokens) {
        batch.delete(db
            .collection("users")
            .doc(userId)
            .collection("pushTokens")
            .doc(tokenDocId(token)));
    }
    await batch.commit();
}
async function sendUserPush(db, userId, message) {
    var _a, _b, _c;
    let messaging;
    try {
        messaging = (0, messaging_1.getMessaging)();
    }
    catch (_d) {
        return;
    }
    if (!(await isPushEnabledForUser(db, userId)))
        return;
    const tokens = await listUserPushTokens(db, userId);
    if (tokens.length === 0)
        return;
    const invalidTokens = [];
    for (const token of tokens) {
        try {
            await messaging.send({
                token,
                notification: {
                    title: message.title,
                    body: message.body,
                },
                data: {
                    title: message.title,
                    body: message.body,
                    url: (_a = message.url) !== null && _a !== void 0 ? _a : "/home",
                    tag: (_b = message.tag) !== null && _b !== void 0 ? _b : "tradiq",
                },
                webpush: {
                    fcmOptions: {
                        link: (_c = message.url) !== null && _c !== void 0 ? _c : "/home",
                    },
                    notification: {
                        icon: "/assets/icon-192.png",
                        badge: "/assets/icon-192.png",
                    },
                },
            });
        }
        catch (error) {
            const code = typeof error === "object" &&
                error !== null &&
                "code" in error &&
                typeof error.code === "string"
                ? error.code
                : "";
            if (code === "messaging/registration-token-not-registered" ||
                code === "messaging/invalid-registration-token") {
                invalidTokens.push(token);
            }
            else {
                console.warn("[push] send failed", { userId, code });
            }
        }
    }
    if (invalidTokens.length > 0) {
        await removeInvalidTokens(db, userId, invalidTokens);
    }
}
async function saveUserPushToken(db, userId, token) {
    await db
        .collection("users")
        .doc(userId)
        .collection("pushTokens")
        .doc(tokenDocId(token))
        .set({
        token,
        platform: "web",
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
//# sourceMappingURL=push.js.map