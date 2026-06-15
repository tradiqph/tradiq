"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  requestPushToken,
  subscribeForegroundMessages,
} from "@/lib/firebase/messaging-client";
import { toast } from "sonner";

async function registerTokenWithServer(token: string, idToken: string) {
  await fetch("/api/push/register", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });
}

/** Registers FCM token and foreground message handler when push is enabled. */
export function usePushNotifications() {
  const { user, profile } = useAuth();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!user || profile?.pushNotificationsEnabled !== true) return;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      if (registeredRef.current) return;

      const token = await requestPushToken();
      if (!token || cancelled) return;

      const idToken = await user.getIdToken();
      await registerTokenWithServer(token, idToken);
      registeredRef.current = true;

      const unsub = await subscribeForegroundMessages((payload) => {
        if (document.visibilityState !== "visible") return;
        toast(payload.title ?? "TradIQ", {
          description: payload.body,
        });
      });
      if (unsub) unsubscribe = unsub;
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user, profile?.pushNotificationsEnabled]);
}
