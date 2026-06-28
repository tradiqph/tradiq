import { Firestore } from "firebase-admin/firestore";
import { getTransferStatus } from "@/lib/paymongo-transfers";
import {
  mirrorTopLevelFromLatestAttempt,
  normalizePayoutAttempts,
  getAuthoritativePayoutAttempt,
  collectRealPaymongoTransferIds,
  upsertPayoutAttemptFromSync,
} from "@/lib/console/payout-attempts";
import {
  isAdminAcknowledgedSuccessfulPayout,
  isRealPaymongoTransferId,
  readTimestampSeconds,
} from "@/lib/console/payout-attempts-shared";

export function extractPaymongoTransferId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;

  const data = root.data;
  if (data && typeof data === "object") {
    const dataObj = data as Record<string, unknown>;

    if (typeof dataObj.id === "string" && dataObj.id.startsWith("tr_")) {
      return dataObj.id;
    }

    const transfers = dataObj.transfers;
    if (Array.isArray(transfers) && transfers.length > 0) {
      const first = transfers[0];
      if (first && typeof first === "object" && "id" in first) {
        const id = (first as { id?: unknown }).id;
        if (typeof id === "string" && id.startsWith("tr_")) return id;
      }
    }

    const nested = dataObj.data;
    if (nested && typeof nested === "object") {
      const nestedId = (nested as { id?: unknown }).id;
      if (typeof nestedId === "string" && nestedId.startsWith("tr_")) {
        return nestedId;
      }
    }
  }

  if (typeof root.id === "string" && root.id.startsWith("tr_")) {
    return root.id;
  }

  return null;
}

async function findWithdrawalByTransferId(
  db: Firestore,
  transferId: string
): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  const byTopLevel = await db
    .collection("withdrawalRequests")
    .where("paymongoTransferId", "==", transferId)
    .limit(1)
    .get();

  if (!byTopLevel.empty) return byTopLevel.docs[0]!;

  const byLedger = await db
    .collection("withdrawalRequests")
    .where("payoutTransferIds", "array-contains", transferId)
    .limit(1)
    .get();

  if (!byLedger.empty) return byLedger.docs[0]!;

  return null;
}

export async function syncWithdrawalTransferFromPayload(
  db: Firestore,
  payload: unknown
): Promise<boolean> {
  const transferId = extractPaymongoTransferId(payload);
  if (!transferId) return false;

  return syncWithdrawalTransferStatus(db, transferId);
}

export async function syncWithdrawalTransferStatus(
  db: Firestore,
  transferId: string
): Promise<boolean> {
  const { status, failureMessage } = await getTransferStatus(transferId);
  if (status === "pending") return true;

  const doc = await findWithdrawalByTransferId(db, transferId);
  if (!doc) return false;

  const data = doc.data();
  if (isAdminAcknowledgedSuccessfulPayout(data)) {
    return true;
  }

  const { payoutAttempts, payoutTransferIds } = upsertPayoutAttemptFromSync(
    data as Record<string, unknown>,
    transferId,
    status,
    failureMessage
  );
  const latest = getAuthoritativePayoutAttempt(payoutAttempts);

  const update: Record<string, unknown> = {
    payoutAttempts,
    payoutTransferIds,
    ...mirrorTopLevelFromLatestAttempt(latest),
  };

  if (status === "failed") {
    update.payoutInFlight = false;
  } else if (status === "succeeded") {
    update.payoutInFlight = false;
  }

  await doc.ref.update(update);
  return true;
}

const SYNC_CONCURRENCY = 8;
const DEFAULT_MAX_SYNC = 25;

async function syncTransferIdsBatch(
  db: Firestore,
  transferIds: string[],
  maxSync = DEFAULT_MAX_SYNC
): Promise<number> {
  const unique = [...new Set(transferIds)].slice(0, maxSync);
  let synced = 0;

  for (let i = 0; i < unique.length; i += SYNC_CONCURRENCY) {
    const batch = unique.slice(i, i + SYNC_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((transferId) => syncWithdrawalTransferStatus(db, transferId))
    );
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) synced += 1;
    }
  }

  return synced;
}

function collectStaleTransferIds(
  data: FirebaseFirestore.DocumentData,
  cutoffMs: number
): string[] {
  if (isAdminAcknowledgedSuccessfulPayout(data)) {
    return [];
  }

  const ids = new Set<string>();
  const attempts = normalizePayoutAttempts(data.payoutAttempts);

  for (const attempt of attempts) {
    if (attempt.status !== "pending" && attempt.status !== "failed") continue;
    if (!isRealPaymongoTransferId(attempt.transferId)) continue;
    const seconds = readTimestampSeconds(attempt.attemptedAt) ?? 0;
    if (seconds * 1000 >= cutoffMs) {
      ids.add(attempt.transferId);
    }
  }

  if (
    (data.paymongoTransferStatus === "pending" ||
      data.paymongoTransferStatus === "failed") &&
    typeof data.paymongoTransferId === "string" &&
    isRealPaymongoTransferId(data.paymongoTransferId)
  ) {
    ids.add(data.paymongoTransferId);
  }

  return [...ids];
}

export function withdrawalDocNeedsPayoutSync(
  data: FirebaseFirestore.DocumentData,
  cutoffMs: number
): boolean {
  return collectStaleTransferIds(data, cutoffMs).length > 0;
}

export function resolveWithdrawalTransferIdToSync(
  data: FirebaseFirestore.DocumentData
): string | null {
  const ids = collectRealPaymongoTransferIds(data as Record<string, unknown>);
  return ids.length > 0 ? ids[ids.length - 1]! : null;
}

async function syncAllWithdrawalTransferIds(
  db: Firestore,
  data: FirebaseFirestore.DocumentData
): Promise<{
  transferId: string;
  status: import("@/lib/paymongo-transfers").PaymongoTransferStatus;
  failureMessage?: string;
  updated: boolean;
}> {
  const transferIds = collectRealPaymongoTransferIds(
    data as Record<string, unknown>
  );
  if (transferIds.length === 0) {
    throw new WithdrawalPayoutSyncError(
      "No PayMongo transfer to sync",
      "bad_request"
    );
  }

  let lastStatus: import("@/lib/paymongo-transfers").PaymongoTransferStatus =
    "pending";
  let lastFailureMessage: string | undefined;
  let lastTransferId = transferIds[transferIds.length - 1]!;
  let updated = false;

  for (const transferId of transferIds) {
    const { status, failureMessage } = await getTransferStatus(transferId);
    lastTransferId = transferId;
    lastStatus = status;
    lastFailureMessage = failureMessage;
    if (status !== "pending") {
      const ok = await syncWithdrawalTransferStatus(db, transferId);
      if (ok) updated = true;
    }
  }

  return {
    transferId: lastTransferId,
    status: lastStatus,
    failureMessage: lastFailureMessage,
    updated,
  };
}

export class WithdrawalPayoutSyncError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "bad_request"
  ) {
    super(message);
    this.name = "WithdrawalPayoutSyncError";
  }
}

export async function syncWithdrawalPayoutForRequest(
  db: Firestore,
  requestId: string
): Promise<{
  transferId: string;
  status: import("@/lib/paymongo-transfers").PaymongoTransferStatus;
  failureMessage?: string;
  updated: boolean;
}> {
  const doc = await db.collection("withdrawalRequests").doc(requestId).get();
  if (!doc.exists) {
    throw new WithdrawalPayoutSyncError("Request not found", "not_found");
  }

  const data = doc.data()!;
  return syncAllWithdrawalTransferIds(db, data);
}

/** Sync pending PayMongo transfers only for the given withdrawal docs. */
export async function syncWithdrawalTransfersForDocs(
  db: Firestore,
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  cutoffMs: number,
  options?: { maxSync?: number }
): Promise<number> {
  const transferIds = new Set<string>();
  for (const doc of docs) {
    for (const id of collectStaleTransferIds(doc.data(), cutoffMs)) {
      transferIds.add(id);
    }
  }
  return syncTransferIdsBatch(db, [...transferIds], options?.maxSync);
}

export async function syncStaleWithdrawalTransfers(
  db: Firestore,
  cutoffMs: number
): Promise<number> {
  const cutoff = new Date(cutoffMs);

  const [pendingSnap, approvedSnap] = await Promise.all([
    db
      .collection("withdrawalRequests")
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get(),
    db
      .collection("withdrawalRequests")
      .where("status", "==", "approved")
      .where("createdAt", ">=", cutoff)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get(),
  ]);

  return syncWithdrawalTransfersForDocs(
    db,
    [...pendingSnap.docs, ...approvedSnap.docs],
    cutoffMs
  );
}

/** @deprecated Use syncStaleWithdrawalTransfers */
export const syncPendingWithdrawalTransfers = syncStaleWithdrawalTransfers;
