"use client";

import { usePushNotifications } from "@/hooks/use-push-notifications";
import { requestPushToken } from "@/lib/firebase/messaging-client";

export function PushNotificationsBootstrap() {
  usePushNotifications();
  return null;
}

export async function enablePushNotifications(user: {
  getIdToken: () => Promise<string>;
}): Promise<boolean> {
  const token = await requestPushToken();
  if (!token) return false;

  const idToken = await user.getIdToken();
  const prefRes = await fetch("/api/push/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled: true }),
  });
  if (!prefRes.ok) return false;

  const regRes = await fetch("/api/push/register", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  return regRes.ok;
}

export async function disablePushNotifications(user: {
  getIdToken: () => Promise<string>;
}): Promise<boolean> {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/push/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled: false }),
  });
  return res.ok;
}
