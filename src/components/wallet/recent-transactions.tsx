"use client";

import Image from "next/image";
import { PesoAmount } from "@/components/ui/peso-amount";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import { TimelineItem } from "@/components/ui/timeline-item";
import { Transaction } from "@/types";
import {
  getTransactionStatusBadge,
  getTransactionTypeLabel,
} from "@/lib/transactions";
import { format } from "date-fns";

interface RecentTransactionsProps {
  transactions: (Transaction & { id: string })[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <div className="px-4 pb-4">
      <SectionHeader
        title="Recent Transactions"
        actionLabel="View All"
        actionHref="/history"
      />

      {transactions.length === 0 ? (
        <div className="surface-flat flex flex-col items-center py-10">
          <Image
            src="/assets/empty-no-transactions.png"
            alt="No transactions"
            width={160}
            height={120}
            className="mb-3 opacity-80"
          />
          <p className="text-sm text-zinc-500">No transactions yet</p>
        </div>
      ) : (
        <div>
          {transactions.map((tx, i) => {
            const statusBadge = getTransactionStatusBadge(tx.status);
            const isInactive =
              tx.status === "expired" || tx.status === "rejected";

            return (
              <TimelineItem
                key={tx.id}
                isLast={i === transactions.length - 1}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-400">
                    {getTransactionTypeLabel(tx.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium capitalize text-white">
                      {tx.title ?? tx.type.replace("_", " ")}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {tx.subtitle ??
                        (tx.createdAt
                          ? format(tx.createdAt.toDate(), "MMM d, yyyy, h:mm a")
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
      )}
    </div>
  );
}
