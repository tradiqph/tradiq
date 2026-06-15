"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { getMissingReferralSourceIds } from "@/lib/transactions";
import { Transaction } from "@/types";
import { useAuth } from "@/hooks/use-auth";

const TRANSACTIONS_LIMIT = 50;

type TransactionRow = Transaction & { id: string };

interface TransactionsContextValue {
  transactions: TransactionRow[];
  loading: boolean;
  referralSourceNames: Record<string, string>;
}

const TransactionsContext = createContext<TransactionsContextValue | null>(null);

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralSourceNames, setReferralSourceNames] = useState<
    Record<string, string>
  >({});
  const referralSourceNamesRef = useRef(referralSourceNames);
  referralSourceNamesRef.current = referralSourceNames;

  useEffect(() => {
    if (!user?.uid || !db) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "users", user.uid, "transactions"),
      orderBy("createdAt", "desc"),
      limit(TRANSACTIONS_LIMIT)
    );

    const unsub = onSnapshot(q, (snap) => {
      setTransactions(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Transaction) }))
      );
      setLoading(false);
    });

    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setReferralSourceNames({});
      return;
    }

    const missingIds = getMissingReferralSourceIds(
      transactions,
      new Set(Object.keys(referralSourceNamesRef.current))
    );
    if (missingIds.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/transactions/referral-sources", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userIds: missingIds }),
        });

        if (!res.ok || cancelled) return;

        const data = (await res.json()) as { labels?: Record<string, string> };
        if (!data.labels || cancelled) return;

        setReferralSourceNames((prev) => ({ ...prev, ...data.labels }));
      } catch {
        // Non-critical enrichment; list still renders without names.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [transactions, user?.uid]);

  const value = useMemo(
    () => ({ transactions, loading, referralSourceNames }),
    [transactions, loading, referralSourceNames]
  );

  return (
    <TransactionsContext.Provider value={value}>
      {children}
    </TransactionsContext.Provider>
  );
}

export function useTransactions(max?: number) {
  const ctx = useContext(TransactionsContext);
  const loading = ctx?.loading ?? true;
  const referralSourceNames = ctx?.referralSourceNames ?? {};
  const transactions = useMemo(() => {
    const all = ctx?.transactions ?? [];
    return max ? all.slice(0, max) : all;
  }, [ctx?.transactions, max]);

  return { transactions, loading, referralSourceNames };
}
