"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { AppHeader } from "@/components/layout/app-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionListItem } from "@/components/wallet/transaction-list-item";
import { usePendingDepositSync } from "@/hooks/use-pending-deposit-sync";
import { useTransactions } from "@/hooks/use-transactions";
import { groupTransactionsByDate } from "@/lib/group-transactions-by-date";
import {
  filterTransactions,
  type TransactionFilter,
} from "@/lib/transactions";
import { cn } from "@/lib/utils";

const filters: { id: TransactionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "deposits", label: "Deposits" },
  { id: "withdrawals", label: "Withdrawals" },
];

export default function HistoryPage() {
  const { transactions, loading, referralSourceNames } = useTransactions(50);
  const hasPendingDeposits = transactions.some(
    (tx) => tx.type === "deposit" && tx.status === "pending"
  );
  usePendingDepositSync(hasPendingDeposits);
  const [filter, setFilter] = useState<TransactionFilter>("all");

  const filtered = useMemo(
    () => filterTransactions(transactions, filter),
    [transactions, filter]
  );
  const groups = groupTransactionsByDate(filtered);

  return (
    <>
      <AppHeader title="Transaction History" showBack backHref="/home" />

      <div className="mb-4 flex gap-4 border-b border-white/5 px-4">
        {filters.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "cursor-pointer pb-2 text-xs font-medium transition-colors",
              filter === id
                ? "border-b-2 border-amber-400 text-amber-400"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 pb-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full bg-zinc-800" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="surface-flat flex flex-col items-center py-12">
            <Image
              src="/assets/empty-no-transactions.png"
              alt="No transactions"
              width={180}
              height={135}
              className="mb-4 opacity-80"
            />
            <p className="text-zinc-500">
              {filter === "all"
                ? "No transactions yet"
                : `No ${filter} yet`}
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-4">
              <SectionHeader title={group.label} />
              {group.items.map((tx, i) => (
                <TransactionListItem
                  key={tx.id}
                  tx={tx}
                  isLast={i === group.items.length - 1}
                  referralSourceNames={referralSourceNames}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}
