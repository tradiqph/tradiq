"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { AppHeader } from "@/components/layout/app-header";
import { PesoAmount } from "@/components/ui/peso-amount";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import { TimelineItem } from "@/components/ui/timeline-item";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useTransactions } from "@/hooks/use-transactions";
import { groupTransactionsByDate } from "@/lib/group-transactions-by-date";
import {
  filterTransactions,
  getTransactionStatusBadge,
  getTransactionTypeLabel,
  type TransactionFilter,
} from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const filters: { id: TransactionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "deposits", label: "Deposits" },
  { id: "withdrawals", label: "Withdrawals" },
];

export default function HistoryPage() {
  const { user } = useAuth();
  const { transactions, loading } = useTransactions(user?.uid, 50);
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
              {group.items.map((tx, i) => {
                const statusBadge = getTransactionStatusBadge(tx.status);
                const isInactive =
                  tx.status === "expired" || tx.status === "rejected";

                return (
                  <TimelineItem
                    key={tx.id}
                    isLast={i === group.items.length - 1}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-400">
                        {getTransactionTypeLabel(tx.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium capitalize text-white">
                          {tx.title ?? tx.type.replace("_", " ")}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {tx.subtitle ??
                            (tx.createdAt
                              ? format(
                                  tx.createdAt.toDate(),
                                  "MMM d, yyyy, h:mm a"
                                )
                              : "")}
                        </p>
                      </div>
                      <div className="text-right">
                        <PesoAmount
                          amount={tx.amount}
                          className={`text-sm ${isInactive ? "line-through text-zinc-500" : "text-white"}`}
                        />
                        <Badge
                          variant={statusBadge.variant}
                          className="mt-1 text-[10px] capitalize"
                        >
                          {statusBadge.label}
                        </Badge>
                      </div>
                    </div>
                  </TimelineItem>
                );
              })}
            </div>
          ))
        )}
      </div>
    </>
  );
}
