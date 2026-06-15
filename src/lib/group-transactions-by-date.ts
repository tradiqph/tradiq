import { format, isToday, isYesterday } from "date-fns";
import { Transaction } from "@/types";

export type TransactionGroup = {
  label: string;
  items: (Transaction & { id: string })[];
};

const LABEL_TODAY = "Today";
const LABEL_YESTERDAY = "Yesterday";

function getGroupMeta(date: Date | undefined): { label: string; sortKey: number } {
  if (!date) {
    return { label: "Earlier", sortKey: Number.MAX_SAFE_INTEGER };
  }

  if (isToday(date)) {
    return { label: LABEL_TODAY, sortKey: 0 };
  }

  if (isYesterday(date)) {
    return { label: LABEL_YESTERDAY, sortKey: 1 };
  }

  return {
    label: format(date, "MMM d, yyyy"),
    sortKey: 2 - date.getTime() / 1e15,
  };
}

export function groupTransactionsByDate(
  transactions: (Transaction & { id: string })[]
): TransactionGroup[] {
  const groups = new Map<
    string,
    { sortKey: number; items: (Transaction & { id: string })[] }
  >();

  for (const tx of transactions) {
    const { label, sortKey } = getGroupMeta(tx.createdAt?.toDate());
    const existing = groups.get(label);

    if (existing) {
      existing.items.push(tx);
      continue;
    }

    groups.set(label, { sortKey, items: [tx] });
  }

  return [...groups.entries()]
    .sort((a, b) => a[1].sortKey - b[1].sortKey)
    .map(([label, { items }]) => ({ label, items }));
}
