"use client";

import Image from "next/image";
import { SectionHeader } from "@/components/ui/section-header";
import { TransactionListItem } from "@/components/wallet/transaction-list-item";
import { Transaction } from "@/types";

interface RecentTransactionsProps {
  transactions: (Transaction & { id: string })[];
  referralSourceNames?: Record<string, string>;
}

export function RecentTransactions({
  transactions,
  referralSourceNames,
}: RecentTransactionsProps) {
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
          {transactions.map((tx, i) => (
            <TransactionListItem
              key={tx.id}
              tx={tx}
              isLast={i === transactions.length - 1}
              referralSourceNames={referralSourceNames}
            />
          ))}
        </div>
      )}
    </div>
  );
}
