"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { UserBot } from "@/types";

export function useUserBots(userId: string | undefined) {
  const [bots, setBots] = useState<(UserBot & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !db) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", userId, "bots"),
      orderBy("subscribedAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setBots(snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserBot) })));
      setLoading(false);
    });

    return unsub;
  }, [userId]);

  const activeCount = bots.filter((b) => b.status === "active").length;
  return { bots, loading, activeCount };
}
