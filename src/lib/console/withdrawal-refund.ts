import { FieldValue, Firestore } from "firebase-admin/firestore";
import { toSerializedPayoutAttempts } from "@/lib/console/payout-attempts";
import { hasUnresolvedPayoutFailure } from "@/lib/console/payout-attempts-shared";
import type { PaymongoTransferStatus } from "@/types";

export class WithdrawalRefundError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "conflict" | "bad_request"
  ) {
    super(message);
    this.name = "WithdrawalRefundError";
  }
}

export type WithdrawalRejectionReason = "admin_rejected" | "payout_failed";

export function canRefundFailedPayout(data: {
  status?: string;
  paymongoTransferStatus?: string;
  payError?: string;
  payoutAttempts?: unknown;
  payoutFailureAcknowledgedAt?: unknown;
}): boolean {
  const payoutAttempts = toSerializedPayoutAttempts(data.payoutAttempts);

  return hasUnresolvedPayoutFailure({
    status: data.status,
    paymongoTransferStatus: data.paymongoTransferStatus as
      | PaymongoTransferStatus
      | undefined,
    payError: data.payError,
    payoutAttempts,
    payoutFailureAcknowledgedAt: data.payoutFailureAcknowledgedAt,
  });
}

export async function findWithdrawalTransaction(
  db: Firestore,
  userId: string,
  requestId: string,
  amount: number
) {
  const byRequestId = await db
    .collection("users")
    .doc(userId)
    .collection("transactions")
    .where("metadata.withdrawalRequestId", "==", requestId)
    .limit(1)
    .get();

  if (!byRequestId.empty) return byRequestId.docs[0];

  const legacy = await db
    .collection("users")
    .doc(userId)
    .collection("transactions")
    .where("type", "==", "withdrawal")
    .where("status", "==", "pending")
    .where("amount", "==", amount)
    .limit(1)
    .get();

  return legacy.empty ? null : legacy.docs[0];
}

export async function refundWithdrawalBalance(
  db: Firestore,
  params: {
    requestId: string;
    adminUid: string;
    rejectionReason: WithdrawalRejectionReason;
    requirePayoutFailure?: boolean;
  }
): Promise<void> {
  const reqRef = db.collection("withdrawalRequests").doc(params.requestId);
  const reqSnap = await reqRef.get();

  if (!reqSnap.exists) {
    throw new WithdrawalRefundError("Request not found", "not_found");
  }

  const reqData = reqSnap.data()!;
  const requestStatus = reqData.status as string;

  if (requestStatus !== "pending" && requestStatus !== "approved") {
    throw new WithdrawalRefundError("Request is not pending", "conflict");
  }

  if (
    params.requirePayoutFailure &&
    !canRefundFailedPayout(reqData)
  ) {
    throw new WithdrawalRefundError(
      "Refund is only available for failed payouts",
      "bad_request"
    );
  }

  const userId = reqData.userId as string;
  const amount = Number(reqData.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new WithdrawalRefundError("Invalid withdrawal amount", "bad_request");
  }
  const wasApproved = requestStatus === "approved";

  await db.runTransaction(async (tx) => {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new Error("User not found");

    const userUpdate: Record<string, FirebaseFirestore.FieldValue | number> = {
      walletBalance: FieldValue.increment(amount),
    };
    if (wasApproved) {
      userUpdate.totalWithdrawn = FieldValue.increment(-amount);
    }

    tx.update(userRef, userUpdate);

    tx.update(reqRef, {
      status: "rejected",
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: params.adminUid,
      rejectionReason: params.rejectionReason,
      paymongoTransferStatus: FieldValue.delete(),
      paymongoTransferId: FieldValue.delete(),
      payError: FieldValue.delete(),
      payoutFailedAt: FieldValue.delete(),
      payoutInFlight: false,
      payoutFailureAcknowledgedAt: FieldValue.delete(),
      payoutFailureAcknowledgedBy: FieldValue.delete(),
    });
  });

  const subtitle =
    params.rejectionReason === "payout_failed"
      ? "Payout failed · balance refunded"
      : "Rejected · balance refunded";

  const txDoc = await findWithdrawalTransaction(
    db,
    userId,
    params.requestId,
    amount
  );

  if (txDoc) {
    await txDoc.ref.update({
      status: "rejected",
      subtitle,
    });
  }
}
