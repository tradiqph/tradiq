import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { PaymongoTransferStatus, PayoutAttempt } from "@/types";
import { resolveWithdrawalPayoutCentavos } from "@/lib/console/instapay-export";
import {
  getFailedAttemptsForDate,
  hasUnresolvedPayoutFailure,
  readTimestampSeconds,
  type SerializedPayoutAttempt,
} from "@/lib/console/payout-attempts-shared";

export type { SerializedPayoutAttempt } from "@/lib/console/payout-attempts-shared";
export {
  getFailedAttemptsForDate,
  getMostRecentFailedAttemptSeconds,
  hasUnresolvedPayoutFailure,
  readTimestampSeconds,
  withdrawalHasFailedAttemptOnDate,
} from "@/lib/console/payout-attempts-shared";

export function normalizePayoutAttempts(raw: unknown): PayoutAttempt[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is PayoutAttempt =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as PayoutAttempt).transferId === "string"
  );
}

function serializeAttemptTimestamp(value: unknown): { seconds: number } {
  const seconds = readTimestampSeconds(value);
  return { seconds: seconds ?? 0 };
}

export function toSerializedPayoutAttempts(
  raw: unknown
): SerializedPayoutAttempt[] {
  return normalizePayoutAttempts(raw).map((attempt) => ({
    transferId: attempt.transferId,
    status: attempt.status,
    centavos: attempt.centavos,
    attemptedAt: serializeAttemptTimestamp(attempt.attemptedAt),
    failedAt: attempt.failedAt
      ? serializeAttemptTimestamp(attempt.failedAt)
      : undefined,
    error: attempt.error,
    attemptedBy: attempt.attemptedBy,
  }));
}

export function buildPayoutAttempt(params: {
  transferId: string;
  status: PaymongoTransferStatus;
  centavos: number;
  attemptedBy: string;
  error?: string;
  failedAt?: Timestamp;
}): Record<string, unknown> {
  const now = Timestamp.now();
  return {
    transferId: params.transferId,
    status: params.status,
    centavos: params.centavos,
    attemptedAt: now,
    attemptedBy: params.attemptedBy,
    ...(params.status === "failed"
      ? {
          failedAt: params.failedAt ?? now,
          error: params.error ?? "Transfer failed",
        }
      : {}),
  };
}

export function appendPayoutAttemptUpdate(
  existingAttempts: unknown,
  attempt: Record<string, unknown>,
  transferIds: unknown
): {
  payoutAttempts: Record<string, unknown>[];
  payoutTransferIds: string[];
} {
  const payoutAttempts = [
    ...normalizePayoutAttempts(existingAttempts).map((item) => ({ ...item })),
    attempt,
  ];
  const payoutTransferIds = [
    ...(Array.isArray(transferIds)
      ? transferIds.filter((id): id is string => typeof id === "string")
      : []),
    String(attempt.transferId),
  ];
  return { payoutAttempts, payoutTransferIds };
}

export function updatePayoutAttemptByTransferId(
  attempts: PayoutAttempt[],
  transferId: string,
  status: PaymongoTransferStatus,
  failureMessage?: string
): PayoutAttempt[] {
  return attempts.map((attempt) => {
    if (attempt.transferId !== transferId) return attempt;
    if (status === "failed") {
      return {
        ...attempt,
        status,
        failedAt: Timestamp.now(),
        error: failureMessage ?? attempt.error ?? "Transfer failed",
      };
    }
    if (status === "succeeded") {
      return {
        transferId: attempt.transferId,
        status,
        centavos: attempt.centavos,
        attemptedAt: attempt.attemptedAt,
        attemptedBy: attempt.attemptedBy,
      };
    }
    return { ...attempt, status };
  });
}

function coalesceFirestoreTimestamp(value: unknown): Timestamp {
  if (value instanceof Timestamp) return value;
  const seconds = readTimestampSeconds(value);
  if (seconds != null) return Timestamp.fromMillis(seconds * 1000);
  return Timestamp.now();
}

/** Update ledger entry on sync, or backfill from top-level pay fields for legacy rows. */
export function upsertPayoutAttemptFromSync(
  data: Record<string, unknown>,
  transferId: string,
  status: PaymongoTransferStatus,
  failureMessage?: string
): { payoutAttempts: PayoutAttempt[]; payoutTransferIds: string[] } {
  const attempts = normalizePayoutAttempts(data.payoutAttempts);
  const matched = attempts.some((attempt) => attempt.transferId === transferId);

  let payoutAttempts: PayoutAttempt[];
  if (matched) {
    payoutAttempts = updatePayoutAttemptByTransferId(
      attempts,
      transferId,
      status,
      failureMessage
    );
  } else if (status === "pending") {
    payoutAttempts = attempts;
  } else {
    const amount = data.amount as number;
    const netPayout = data.netPayout as number | undefined;
    const attemptedAt = coalesceFirestoreTimestamp(data.paidAt);
    const backfill: PayoutAttempt = {
      transferId,
      status,
      centavos: resolveWithdrawalPayoutCentavos(amount, netPayout),
      attemptedAt,
      attemptedBy: (data.paidBy as string) ?? "sync",
      ...(status === "failed"
        ? {
            failedAt: attemptedAt,
            error: failureMessage ?? "Transfer failed",
          }
        : {}),
    };
    payoutAttempts = [...attempts, backfill];
  }

  const existingIds = Array.isArray(data.payoutTransferIds)
    ? data.payoutTransferIds.filter((id): id is string => typeof id === "string")
    : [];
  const payoutTransferIds = [...new Set([...existingIds, transferId])];

  return { payoutAttempts, payoutTransferIds };
}

export function getLatestPayoutAttempt(
  attempts: PayoutAttempt[]
): PayoutAttempt | null {
  if (attempts.length === 0) return null;
  return attempts[attempts.length - 1] ?? null;
}

export function getLatestRealPayoutAttempt(
  attempts: PayoutAttempt[]
): PayoutAttempt | null {
  for (let i = attempts.length - 1; i >= 0; i -= 1) {
    const attempt = attempts[i]!;
    if (attempt.transferId.startsWith("tr_")) return attempt;
  }
  return null;
}

/** Prefer succeeded real transfer for top-level mirror when retries exist. */
export function getAuthoritativePayoutAttempt(
  attempts: PayoutAttempt[]
): PayoutAttempt | null {
  const real = attempts.filter((a) => a.transferId.startsWith("tr_"));
  const succeeded = real.filter((a) => a.status === "succeeded");
  if (succeeded.length > 0) {
    return succeeded[succeeded.length - 1] ?? null;
  }
  return getLatestRealPayoutAttempt(attempts);
}

export function collectRealPaymongoTransferIds(
  data: Record<string, unknown>
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value !== "string" || !value.startsWith("tr_") || seen.has(value)) {
      return;
    }
    seen.add(value);
    ids.push(value);
  };

  if (Array.isArray(data.payoutTransferIds)) {
    for (const id of data.payoutTransferIds) add(id);
  }
  for (const attempt of normalizePayoutAttempts(data.payoutAttempts)) {
    add(attempt.transferId);
  }
  add(data.paymongoTransferId);

  return ids;
}

export function mirrorTopLevelFromLatestAttempt(
  latest: PayoutAttempt | null
): Record<string, unknown> {
  if (!latest) return {};

  const update: Record<string, unknown> = {
    paymongoTransferId: latest.transferId,
    paymongoTransferStatus: latest.status,
    paidAt: latest.attemptedAt,
    paidBy: latest.attemptedBy,
    payoutInFlight: false,
  };

  if (latest.status === "failed") {
    update.payError = latest.error ?? "Transfer failed";
    update.payoutFailedAt = latest.failedAt ?? latest.attemptedAt;
  } else if (latest.status === "succeeded") {
    update.payError = FieldValue.delete();
    update.payoutFailedAt = FieldValue.delete();
  }

  return update;
}

export function collectPendingTransferIdsToSync(
  data: Record<string, unknown>,
  cutoffMs: number
): string[] {
  const ids = new Set<string>();
  const attempts = normalizePayoutAttempts(data.payoutAttempts);

  for (const attempt of attempts) {
    if (attempt.status !== "pending") continue;
    const seconds = readTimestampSeconds(attempt.attemptedAt) ?? 0;
    if (seconds * 1000 >= cutoffMs) {
      ids.add(attempt.transferId);
    }
  }

  if (
    data.paymongoTransferStatus === "pending" &&
    typeof data.paymongoTransferId === "string"
  ) {
    ids.add(data.paymongoTransferId);
  }

  return [...ids];
}

function serializeTimestampField(
  value: unknown
): { seconds: number } | undefined {
  const seconds = readTimestampSeconds(value);
  return seconds != null ? { seconds } : undefined;
}

export function enrichWithdrawalForApi(
  id: string,
  data: Record<string, unknown>,
  dateKey?: string
): Record<string, unknown> {
  const payoutAttempts = toSerializedPayoutAttempts(data.payoutAttempts);
  const base: Record<string, unknown> = {
    id,
    ...data,
    createdAt: serializeTimestampField(data.createdAt),
    reviewedAt: serializeTimestampField(data.reviewedAt),
    paidAt: serializeTimestampField(data.paidAt),
    payoutFailedAt: serializeTimestampField(data.payoutFailedAt),
    payoutFailureAcknowledgedAt: serializeTimestampField(
      data.payoutFailureAcknowledgedAt
    ),
    payoutAttempts,
  };

  if (!dateKey) return base;

  const failedAttemptsOnDate = getFailedAttemptsForDate(
    payoutAttempts,
    dateKey
  ).length;

  return {
    ...base,
    failedAttemptsOnDate,
    unresolvedFailure: hasUnresolvedPayoutFailure({
      status: data.status as string | undefined,
      paymongoTransferStatus: data.paymongoTransferStatus as
        | PaymongoTransferStatus
        | undefined,
      payError: data.payError as string | undefined,
      payoutAttempts,
      payoutFailureAcknowledgedAt: data.payoutFailureAcknowledgedAt,
    }),
  };
}
