"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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
import { Transaction } from "@/types";
import { useAuth } from "@/hooks/use-auth";

const TRANSACTIONS_LIMIT = 50;

type TransactionRow = Transaction & { id: string };

interface TransactionsContextValue {
  transactions: TransactionRow[];
  loading: boolean;
}

const TransactionsContext = createContext<TransactionsContextValue | null>(null);

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  const value = useMemo(
    () => ({ transactions, loading }),
    [transactions, loading]
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
  const transactions = useMemo(() => {
    const all = ctx?.transactions ?? [];
    return max ? all.slice(0, max) : all;
  }, [ctx?.transactions, max]);

  return { transactions, loading };
}
