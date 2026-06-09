import { TransactionStatus } from "@/types";

export type TransactionFilter = "all" | "deposits" | "withdrawals";

export function getTransactionStatusBadge(status: TransactionStatus): {
  variant: "default" | "destructive" | "secondary";
  label: string;
} {
  switch (status) {
    case "paid":
    case "approved":
      return { variant: "default", label: status };
    case "expired":
    case "rejected":
      return { variant: "destructive", label: status };
    case "pending":
    default:
      return { variant: "secondary", label: status };
  }
}

export function filterTransactions<
  T extends { type: string },
>(transactions: T[], filter: TransactionFilter): T[] {
  if (filter === "deposits") {
    return transactions.filter((tx) => tx.type === "deposit");
  }
  if (filter === "withdrawals") {
    return transactions.filter((tx) => tx.type === "withdrawal");
  }
  return transactions;
}

export function getTransactionTypeLabel(type: string): string {
  if (type === "deposit") return "QR";
  if (type === "withdrawal") return "WD";
  return type.slice(0, 2).toUpperCase();
}
