import { createHash } from "crypto";
import { Firestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function signedAmount(amount: number): string {
  return `+${formatPeso(amount)}`;
}

export function dailyEarningPushMessage(amount: number): PushMessage {
  return {
    title: "Daily earnings credited",
    body: `${signedAmount(amount)} from your bot subscription was added to your Wallet Balance.`,
    url: "/history",
    tag: "daily-earning",
  };
}

export function finalEarningPushMessage(amount: number): PushMessage {
  return {
    title: "Final earnings credited",
    body: `${signedAmount(amount)} from your bot subscription was added to your Wallet Balance.`,
    url: "/history",
    tag: "final-earning",
  };
}

export function principalReturnPushMessage(amount: number): PushMessage {
  return {
    title: "Principal returned",
    body: `${signedAmount(amount)} principal from your completed bot subscription was added to your Wallet Balance.`,
    url: "/history",
    tag: "principal-return",
  };
}

function tokenDocId(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 32);
}

async function isPushEnabledForUser(
  db: Firestore,
  userId: string
): Promise<boolean> {
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) return false;
  return snap.data()?.pushNotificationsEnabled === true;
}

async function listUserPushTokens(
  db: Firestore,
  userId: string
): Promise<string[]> {
  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("pushTokens")
    .get();

  return snap.docs
    .map((doc) => doc.data().token as string | undefined)
    .filter((token): token is string => typeof token === "string" && token.length > 0);
}

async function removeInvalidTokens(
  db: Firestore,
  userId: string,
  tokens: string[]
): Promise<void> {
  if (tokens.length === 0) return;
  const batch = db.batch();
  for (const token of tokens) {
    batch.delete(
      db
        .collection("users")
        .doc(userId)
        .collection("pushTokens")
        .doc(tokenDocId(token))
    );
  }
  await batch.commit();
}

export async function sendUserPush(
  db: Firestore,
  userId: string,
  message: PushMessage
): Promise<void> {
  let messaging;
  try {
    messaging = getMessaging();
  } catch {
    return;
  }

  if (!(await isPushEnabledForUser(db, userId))) return;

  const tokens = await listUserPushTokens(db, userId);
  if (tokens.length === 0) return;

  const invalidTokens: string[] = [];

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
          url: message.url ?? "/home",
          tag: message.tag ?? "tradiq",
        },
        webpush: {
          fcmOptions: {
            link: message.url ?? "/home",
          },
          notification: {
            icon: "/assets/icon-192.png",
            badge: "/assets/icon-192.png",
          },
        },
      });
    } catch (error) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code: unknown }).code === "string"
          ? (error as { code: string }).code
          : "";

      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        invalidTokens.push(token);
      } else {
        console.warn("[push] send failed", { userId, code });
      }
    }
  }

  if (invalidTokens.length > 0) {
    await removeInvalidTokens(db, userId, invalidTokens);
  }
}

export async function saveUserPushToken(
  db: Firestore,
  userId: string,
  token: string
): Promise<void> {
  await db
    .collection("users")
    .doc(userId)
    .collection("pushTokens")
    .doc(tokenDocId(token))
    .set(
      {
        token,
        platform: "web",
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}
