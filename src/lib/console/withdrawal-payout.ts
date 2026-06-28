import { FieldValue, Firestore } from "firebase-admin/firestore";
import {
  normalizeInstapayAccountNumber,
  type InstapayAccountSnapshot,
} from "@/lib/console/instapay-banks";
import { resolveWithdrawalPayoutCentavos } from "@/lib/console/instapay-export";
import {
  appendPayoutAttemptUpdate,
  buildPayoutAttempt,
  normalizePayoutAttempts,
} from "@/lib/console/payout-attempts";
import { readTimestampSeconds } from "@/lib/console/payout-attempts-shared";
import {
  createInstapayTransfer,
  resolveDestinationBic,
} from "@/lib/paymongo-transfers";

export class WithdrawalPayoutError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "conflict" | "bad_request" | "config"
  ) {
    super(message);
    this.name = "WithdrawalPayoutError";
  }
}

async function persistPayoutAttempt(
  reqRef: FirebaseFirestore.DocumentReference,
  params: {
    transferId: string;
    status: "pending" | "succeeded" | "failed";
    centavos: number;
    attemptedBy: string;
    error?: string;
  }
) {
  const snap = await reqRef.get();
  const data = snap.data() ?? {};

  const attempt = buildPayoutAttempt({
    transferId: params.transferId,
    status: params.status,
    centavos: params.centavos,
    attemptedBy: params.attemptedBy,
    error: params.error,
  });

  const { payoutAttempts, payoutTransferIds } = appendPayoutAttemptUpdate(
    data.payoutAttempts,
    attempt,
    data.payoutTransferIds
  );

  const topLevel: Record<string, unknown> = {
    paymongoTransferId: params.transferId,
    paymongoTransferStatus: params.status,
    paidAt: FieldValue.serverTimestamp(),
    paidBy: params.attemptedBy,
    payoutInFlight: false,
    payoutAttempts,
    payoutTransferIds,
  };

  if (params.status === "failed") {
    topLevel.payError = params.error ?? "Transfer failed";
    topLevel.payoutFailedAt = FieldValue.serverTimestamp();
  } else if (params.status === "succeeded") {
    topLevel.payError = FieldValue.delete();
    topLevel.payoutFailedAt = FieldValue.delete();
  }

  await reqRef.update(topLevel);
}

async function persistTopLevelPayout(
  reqRef: FirebaseFirestore.DocumentReference,
  params: {
    transferId: string;
    status: "pending" | "succeeded" | "failed";
    attemptedBy: string;
    error?: string;
  }
) {
  const topLevel: Record<string, unknown> = {
    paymongoTransferId: params.transferId,
    paymongoTransferStatus: params.status,
    paidAt: FieldValue.serverTimestamp(),
    paidBy: params.attemptedBy,
    payoutInFlight: false,
  };

  if (params.status === "failed") {
    topLevel.payError = params.error ?? "Transfer failed";
    topLevel.payoutFailedAt = FieldValue.serverTimestamp();
  } else if (params.status === "succeeded") {
    topLevel.payError = FieldValue.delete();
    topLevel.payoutFailedAt = FieldValue.delete();
  }

  await reqRef.update(topLevel);
}

export async function initiateWithdrawalPayout(
  db: Firestore,
  params: { requestId: string; adminUid: string }
): Promise<{ transferId: string; status: string; centavos: number }> {
  const reqRef = db.collection("withdrawalRequests").doc(params.requestId);

  const locked = await db.runTransaction(async (tx) => {
    const snap = await tx.get(reqRef);
    if (!snap.exists) {
      throw new WithdrawalPayoutError("Request not found", "not_found");
    }

    const data = snap.data()!;
    const requestStatus = data.status as string;
    const attempts = normalizePayoutAttempts(data.payoutAttempts);
    const latestReal = [...attempts]
      .reverse()
      .find((attempt) => attempt.transferId.startsWith("tr_"));
    const latestStatus =
      latestReal?.status ??
      (data.paymongoTransferStatus as string | undefined);
    const alreadySucceeded =
      data.paymongoTransferStatus === "succeeded" ||
      attempts.some(
        (attempt) =>
          attempt.transferId.startsWith("tr_") && attempt.status === "succeeded"
      );

    const canRetryApprovedPayout =
      requestStatus === "approved" &&
      !alreadySucceeded &&
      (latestStatus === "failed" || data.paymongoTransferStatus === "failed");

    if (requestStatus !== "pending" && !canRetryApprovedPayout) {
      throw new WithdrawalPayoutError("Withdrawal is not pending", "conflict");
    }

    if (alreadySucceeded) {
      throw new WithdrawalPayoutError("Already paid via PayMongo", "conflict");
    }

    if (
      data.paymongoTransferId &&
      latestStatus !== "failed" &&
      data.paymongoTransferStatus !== "failed"
    ) {
      throw new WithdrawalPayoutError("Already paid via PayMongo", "conflict");
    }
    if (data.payoutInFlight === true) {
      const lockedAt = readTimestampSeconds(data.payoutLockedAt);
      const staleLockMs = 5 * 60 * 1000;
      const lockIsStale =
        lockedAt != null && Date.now() - lockedAt * 1000 >= staleLockMs;
      if (!lockIsStale) {
        throw new WithdrawalPayoutError("Payout already in progress", "conflict");
      }
    }

    const accountSnapshot = data.accountSnapshot as InstapayAccountSnapshot;
    const amount = data.amount as number;
    const netPayout = data.netPayout as number | undefined;
    const centavos = resolveWithdrawalPayoutCentavos(amount, netPayout);

    if (centavos <= 0) {
      throw new WithdrawalPayoutError("Invalid payout amount", "bad_request");
    }

    tx.update(reqRef, {
      payoutInFlight: true,
      payoutLockedBy: params.adminUid,
      payoutLockedAt: FieldValue.serverTimestamp(),
    });

    return { accountSnapshot, centavos };
  });

  let createdTransferId: string | null = null;
  let createdStatus: "pending" | "succeeded" | "failed" | null = null;

  try {
    const bic = await resolveDestinationBic(locked.accountSnapshot);
    const { transferId, status } = await createInstapayTransfer({
      centavos: locked.centavos,
      accountName: locked.accountSnapshot.accountName,
      accountNumber: normalizeInstapayAccountNumber(
        locked.accountSnapshot.accountNumber
      ),
      bic,
    });
    createdTransferId = transferId;
    createdStatus = status;

    await persistTopLevelPayout(reqRef, {
      transferId,
      status,
      attemptedBy: params.adminUid,
    });

    await persistPayoutAttempt(reqRef, {
      transferId,
      status,
      centavos: locked.centavos,
      attemptedBy: params.adminUid,
    });

    return { transferId, status, centavos: locked.centavos };
  } catch (err) {
    if (err instanceof WithdrawalPayoutError) {
      throw err;
    }

    const message =
      err instanceof Error ? err.message : "PayMongo transfer failed";

    if (createdTransferId) {
      try {
        await persistPayoutAttempt(reqRef, {
          transferId: createdTransferId,
          status: createdStatus ?? "pending",
          centavos: locked.centavos,
          attemptedBy: params.adminUid,
        });
      } catch {
        // Top-level paymongoTransferId was already saved above.
      }

      throw new WithdrawalPayoutError(
        "Payout sent to PayMongo but record update failed. Click Refresh status.",
        "bad_request"
      );
    }

    try {
      await persistPayoutAttempt(reqRef, {
        transferId: `api_${Date.now()}`,
        status: "failed",
        centavos: locked.centavos,
        attemptedBy: params.adminUid,
        error: message,
      });
    } catch {
      await reqRef.update({
        payoutInFlight: false,
        payError: message,
      });
    }

    if (
      message.includes("wallet not configured") ||
      message.includes("Paymongo not configured")
    ) {
      throw new WithdrawalPayoutError(message, "config");
    }

    throw new WithdrawalPayoutError(message, "bad_request");
  }
}
