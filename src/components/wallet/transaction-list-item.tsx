"use client";

import { Badge } from "@/components/ui/badge";
import { TimelineItem } from "@/components/ui/timeline-item";
import { Transaction } from "@/types";
import {
  formatSignedPeso,
  getTransactionAmountClassName,
  getTransactionAmountSign,
  getTransactionStatusBadge,
  getTransactionSubtitle,
  getTransactionTypeLabel,
} from "@/lib/transactions";

interface TransactionListItemProps {
  tx: Transaction & { id: string };
  isLast: boolean;
  referralSourceNames?: Record<string, string>;
}

export function TransactionListItem({
  tx,
  isLast,
  referralSourceNames,
}: TransactionListItemProps) {
  const sign = getTransactionAmountSign(tx);
  const statusBadge = getTransactionStatusBadge(tx);
  const isInactive =
    tx.status === "expired" ||
    tx.status === "rejected" ||
    String(tx.status).toLowerCase() === "expired" ||
    String(tx.status).toLowerCase() === "rejected";

  return (
    <TimelineItem isLast={isLast}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-400">
          {getTransactionTypeLabel(tx)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium capitalize text-white">
            {tx.title ?? tx.type.replace("_", " ")}
          </p>
          <p className="truncate text-xs text-zinc-500">
            {getTransactionSubtitle(tx, referralSourceNames)}
          </p>
        </div>
        <div className="text-right">
          <span
            className={`text-sm font-bold tabular-nums ${getTransactionAmountClassName(sign, isInactive)}`}
          >
            {formatSignedPeso(tx.amount, sign)}
          </span>
          <Badge
            variant={statusBadge.variant}
            className="mt-1 text-[10px]"
          >
            {statusBadge.label}
          </Badge>
        </div>
      </div>
    </TimelineItem>
  );
}
