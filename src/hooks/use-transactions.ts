"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Transaction } from "@/types";

export function useTransactions(userId: string | undefined, max = 10) {
  const [transactions, setTransactions] = useState<
    (Transaction & { id: string })[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !db) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", userId, "transactions"),
      orderBy("createdAt", "desc"),
      limit(max)
    );

    const unsub = onSnapshot(q, (snap) => {
      setTransactions(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Transaction) }))
      );
      setLoading(false);
    });

    return unsub;
  }, [userId, max]);

  return { transactions, loading };
}
