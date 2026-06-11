import { Transaction } from "@/types";
import { formatPeso } from "@/lib/finance";

export type TransactionFilter = "all" | "deposits" | "withdrawals";
export type TransactionAmountSign = "+" | "-" | null;

export function getTransactionAmountSign(
  tx: Pick<Transaction, "type" | "status">
): TransactionAmountSign {
  const { type, status } = tx;

  if (status === "expired" || status === "rejected") {
    return null;
  }

  switch (type) {
    case "deposit":
      return status === "paid" ? "+" : null;
    case "earning":
    case "referral":
      return "+";
    case "bot_subscribe":
      return "-";
    case "withdrawal":
      return status === "pending" || status === "approved" ? "-" : null;
    default:
      return null;
  }
}

export function formatSignedPeso(
  amount: number,
  sign: TransactionAmountSign
): string {
  const formatted = formatPeso(amount);
  if (sign === "+") return `+${formatted}`;
  if (sign === "-") return `-${formatted}`;
  return formatted;
}

export function getTransactionAmountClassName(
  sign: TransactionAmountSign,
  isInactive: boolean
): string {
  if (isInactive) return "line-through text-zinc-500";
  if (sign === "+") return "text-emerald-400";
  if (sign === "-") return "text-red-400";
  return "text-white";
}

export function getTransactionStatusBadge(
  tx: Pick<Transaction, "type" | "status">
): {
  variant: "default" | "destructive" | "secondary";
  label: string;
} {
  const { type, status } = tx;

  if (status === "pending") {
    return { variant: "secondary", label: "Pending" };
  }
  if (status === "expired") {
    return { variant: "destructive", label: "Expired" };
  }
  if (status === "rejected") {
    return { variant: "destructive", label: "Rejected" };
  }

  switch (type) {
    case "deposit":
      if (status === "paid") {
        return { variant: "default", label: "Added to wallet" };
      }
      break;
    case "earning":
    case "referral":
      if (status === "paid") {
        return { variant: "default", label: "Added to wallet" };
      }
      break;
    case "bot_subscribe":
      if (status === "paid") {
        return { variant: "default", label: "Invested" };
      }
      break;
    case "withdrawal":
      if (status === "approved") {
        return { variant: "default", label: "Paid" };
      }
      break;
  }

  return { variant: "secondary", label: status };
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
