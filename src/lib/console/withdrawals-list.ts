import type { SerializedPayoutAttempt } from "@/lib/console/payout-attempts-shared";
import { hasUnresolvedPayoutFailure } from "@/lib/console/payout-attempts-shared";

export interface WithdrawalListItem {
  id: string;
  userEmail: string;
  amount: number;
  netPayout?: number;
  accountSnapshot: {
    label: string;
    accountType: string;
    accountNumber: string;
    accountName: string;
    bankName?: string;
  };
  createdAt?: { seconds: number };
  reviewedAt?: { seconds: number };
  paidAt?: { seconds: number };
  payoutFailedAt?: { seconds: number };
  payoutFailureAcknowledgedAt?: { seconds: number };
  paymongoTransferStatus?: string;
  payError?: string;
  status?: string;
  rejectionReason?: string;
  payoutAttempts?: SerializedPayoutAttempt[];
  failedAttemptsOnDate?: number;
  unresolvedFailure?: boolean;
}

export function isActionablePayoutFailure(data: {
  status?: string;
  paymongoTransferStatus?: string;
  payError?: string;
  payoutAttempts?: SerializedPayoutAttempt[];
  payoutFailureAcknowledgedAt?: unknown;
}): boolean {
  return hasUnresolvedPayoutFailure({
    ...data,
    paymongoTransferStatus: data.paymongoTransferStatus as
      | import("@/types").PaymongoTransferStatus
      | undefined,
  });
}

export function withdrawalMatchesSearch(
  request: WithdrawalListItem,
  search: string
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;

  const snap = request.accountSnapshot;
  const haystack = [
    request.id,
    request.userEmail,
    snap.label,
    snap.accountType,
    snap.accountNumber,
    snap.accountName,
    snap.bankName,
    String(request.amount),
    request.netPayout != null ? String(request.netPayout) : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

/** Best timestamp for when a payout failure occurred (for date filtering). */
export function getPayoutFailedTimestampSeconds(
  request: Pick<
    WithdrawalListItem,
    "payoutFailedAt" | "paidAt" | "createdAt"
  >
): number | null {
  const ts =
    request.payoutFailedAt ?? request.paidAt ?? request.createdAt ?? null;
  return ts?.seconds ?? null;
}

export function withdrawalMatchesFailedDate(
  request: Pick<
    WithdrawalListItem,
    "payoutFailedAt" | "paidAt" | "createdAt"
  >,
  dateKey: string
): boolean {
  const seconds = getPayoutFailedTimestampSeconds(request);
  if (!seconds) return false;

  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(new Date(seconds * 1000));

  return key === dateKey;
}
