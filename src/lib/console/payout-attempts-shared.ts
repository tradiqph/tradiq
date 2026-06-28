import type { PaymongoTransferStatus } from "@/types";

export interface SerializedPayoutAttempt {
  transferId: string;
  status: PaymongoTransferStatus;
  centavos: number;
  attemptedAt: { seconds: number };
  failedAt?: { seconds: number };
  error?: string;
  attemptedBy: string;
}

export function readTimestampSeconds(value: unknown): number | null {
  if (!value) return null;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    const ms = (value as { toDate: () => Date }).toDate().getTime();
    return Math.floor(ms / 1000);
  }
  if (typeof (value as { seconds?: number }).seconds === "number") {
    return (value as { seconds: number }).seconds;
  }
  return null;
}

export function attemptMatchesFailedDate(
  attempt: SerializedPayoutAttempt | { status: string; failedAt?: unknown; attemptedAt: unknown },
  dateKey: string
): boolean {
  if (attempt.status !== "failed") return false;

  const seconds =
    "failedAt" in attempt && attempt.failedAt
      ? readTimestampSeconds(attempt.failedAt)
      : readTimestampSeconds(attempt.attemptedAt);

  if (!seconds) return false;

  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(new Date(seconds * 1000));

  return key === dateKey;
}

export function getFailedAttemptsForDate(
  attempts: SerializedPayoutAttempt[],
  dateKey: string
): SerializedPayoutAttempt[] {
  return attempts.filter((attempt) => attemptMatchesFailedDate(attempt, dateKey));
}

export function isRealPaymongoTransferId(transferId: string): boolean {
  return transferId.startsWith("tr_");
}

function latestRealPayoutAttempt(
  payoutAttempts?: SerializedPayoutAttempt[]
): SerializedPayoutAttempt | null {
  if (!payoutAttempts?.length) return null;
  for (let i = payoutAttempts.length - 1; i >= 0; i -= 1) {
    const attempt = payoutAttempts[i]!;
    if (isRealPaymongoTransferId(attempt.transferId)) return attempt;
  }
  return null;
}

export function hasSucceededPayoutAttempt(
  payoutAttempts?: SerializedPayoutAttempt[]
): boolean {
  return (
    payoutAttempts?.some(
      (attempt) =>
        isRealPaymongoTransferId(attempt.transferId) &&
        attempt.status === "succeeded"
    ) ?? false
  );
}

export function isPayoutFailureAcknowledged(data: {
  payoutFailureAcknowledgedAt?: unknown;
}): boolean {
  return readTimestampSeconds(data.payoutFailureAcknowledgedAt) != null;
}

export function hasUnresolvedPayoutFailure(data: {
  status?: string;
  paymongoTransferStatus?: PaymongoTransferStatus;
  payError?: string;
  payoutAttempts?: SerializedPayoutAttempt[];
  payoutFailureAcknowledgedAt?: unknown;
}): boolean {
  if (data.status !== "pending" && data.status !== "approved") return false;

  if (hasSucceededPayoutAttempt(data.payoutAttempts)) return false;
  if (data.paymongoTransferStatus === "succeeded") return false;

  const latest = latestRealPayoutAttempt(data.payoutAttempts);

  if (latest) {
    if (latest.status === "failed") return true;
    if (data.status === "approved" && latest.status === "pending") return true;
  }

  if (data.paymongoTransferStatus === "failed") return true;
  if (
    data.status === "approved" &&
    data.paymongoTransferStatus === "pending"
  ) {
    return true;
  }
  if (data.payError) return true;

  // Acknowledgment only resolves historical failures, not a new failed payout.
  if (isPayoutFailureAcknowledged(data)) return false;

  return false;
}

export function withdrawalHasFailedAttemptOnDate(
  data: {
    status?: string;
    paymongoTransferStatus?: PaymongoTransferStatus | string;
    payError?: string;
    payoutFailedAt?: { seconds: number };
    paidAt?: { seconds: number };
    createdAt?: { seconds: number };
    payoutAttempts?: SerializedPayoutAttempt[];
    payoutFailureAcknowledgedAt?: unknown;
  },
  dateKey: string
): boolean {
  if (hasSucceededPayoutAttempt(data.payoutAttempts)) return false;
  if (data.paymongoTransferStatus === "succeeded") return false;
  if (
    isPayoutFailureAcknowledged(data) &&
    data.paymongoTransferStatus !== "failed" &&
    !data.payError
  ) {
    return false;
  }

  const failedFromLedger = getFailedAttemptsForDate(
    data.payoutAttempts ?? [],
    dateKey
  );
  if (failedFromLedger.length > 0) return true;

  // Legacy rows without payoutAttempts
  if (data.status !== "pending" && data.status !== "approved") return false;
  if (data.paymongoTransferStatus !== "failed" && !data.payError) return false;

  const seconds =
    data.payoutFailedAt?.seconds ??
    data.paidAt?.seconds ??
    data.createdAt?.seconds ??
    null;
  if (!seconds) return false;

  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(new Date(seconds * 1000));

  return key === dateKey;
}

export function getMostRecentFailedAttemptSeconds(
  attempts: SerializedPayoutAttempt[],
  dateKey: string
): number {
  const failed = getFailedAttemptsForDate(attempts, dateKey);
  if (failed.length === 0) return 0;
  return Math.max(
    ...failed.map((a) => a.failedAt?.seconds ?? a.attemptedAt.seconds ?? 0)
  );
}
