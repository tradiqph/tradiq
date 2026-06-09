import { isToday, isYesterday } from "date-fns";
import { Transaction } from "@/types";

export type TransactionGroup = {
  label: string;
  items: (Transaction & { id: string })[];
};

export function groupTransactionsByDate(
  transactions: (Transaction & { id: string })[]
): TransactionGroup[] {
  const groups: Record<string, (Transaction & { id: string })[]> = {};

  for (const tx of transactions) {
    const date = tx.createdAt?.toDate();
    let label = "Earlier";

    if (date) {
      if (isToday(date)) label = "Today";
      else if (isYesterday(date)) label = "Yesterday";
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  }

  const order = ["Today", "Yesterday", "Earlier"];
  return order
    .filter((label) => groups[label]?.length)
    .map((label) => ({ label, items: groups[label] }));
}
