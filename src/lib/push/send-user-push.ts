import { createHash } from "crypto";
import { Firestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { getAdminApp } from "@/lib/firebase/admin";
import type { PushMessage } from "@/lib/push/copy";

function tokenDocId(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 32);
}

function getMessagingClient(): Messaging | null {
  const app = getAdminApp();
  if (!app) return null;
  try {
    return getMessaging(app);
  } catch {
    return null;
  }
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
): Promise<{ sent: number; failed: number }> {
  const messaging = getMessagingClient();
  if (!messaging) {
    return { sent: 0, failed: 0 };
  }

  if (!(await isPushEnabledForUser(db, userId))) {
    return { sent: 0, failed: 0 };
  }

  const tokens = await listUserPushTokens(db, userId);
  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const invalidTokens: string[] = [];
  let sent = 0;
  let failed = 0;

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
      sent += 1;
    } catch (error) {
      failed += 1;
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
        console.warn("[push] send failed", { userId, code, error });
      }
    }
  }

  if (invalidTokens.length > 0) {
    await removeInvalidTokens(db, userId, invalidTokens);
  }

  return { sent, failed };
}

export async function saveUserPushToken(
  db: Firestore,
  userId: string,
  token: string,
  userAgent?: string
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
        userAgent: userAgent ?? null,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  await db.collection("users").doc(userId).set(
    { pushNotificationsEnabled: true },
    { merge: true }
  );
}

export async function removeUserPushToken(
  db: Firestore,
  userId: string,
  token: string
): Promise<void> {
  await db
    .collection("users")
    .doc(userId)
    .collection("pushTokens")
    .doc(tokenDocId(token))
    .delete();
}

export async function removeAllUserPushTokens(
  db: Firestore,
  userId: string
): Promise<void> {
  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("pushTokens")
    .get();

  if (snap.empty) return;

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
}

export async function setUserPushEnabled(
  db: Firestore,
  userId: string,
  enabled: boolean
): Promise<void> {
  await db.collection("users").doc(userId).set(
    { pushNotificationsEnabled: enabled },
    { merge: true }
  );

  if (!enabled) {
    await removeAllUserPushTokens(db, userId);
  }
}
