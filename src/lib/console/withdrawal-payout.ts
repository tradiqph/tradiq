import { FieldValue, Firestore } from "firebase-admin/firestore";
import {
  normalizeInstapayAccountNumber,
  type InstapayAccountSnapshot,
} from "@/lib/console/instapay-banks";
import { resolveWithdrawalPayoutCentavos } from "@/lib/console/instapay-export";
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
    if (data.status !== "pending") {
      throw new WithdrawalPayoutError("Withdrawal is not pending", "conflict");
    }
    if (
      data.paymongoTransferId &&
      data.paymongoTransferStatus !== "failed"
    ) {
      throw new WithdrawalPayoutError("Already paid via PayMongo", "conflict");
    }
    if (data.payoutInFlight === true) {
      throw new WithdrawalPayoutError("Payout already in progress", "conflict");
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

    await reqRef.update({
      paymongoTransferId: transferId,
      paymongoTransferStatus: status,
      paidBy: params.adminUid,
      paidAt: FieldValue.serverTimestamp(),
      payoutInFlight: false,
      payError: FieldValue.delete(),
    });

    return { transferId, status, centavos: locked.centavos };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "PayMongo transfer failed";

    await reqRef.update({
      payoutInFlight: false,
      payError: message,
    });

    if (
      message.includes("wallet not configured") ||
      message.includes("Paymongo not configured")
    ) {
      throw new WithdrawalPayoutError(message, "config");
    }

    throw new WithdrawalPayoutError(message, "bad_request");
  }
}
