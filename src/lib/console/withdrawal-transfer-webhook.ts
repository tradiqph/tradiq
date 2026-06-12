import { FieldValue, Firestore } from "firebase-admin/firestore";
import { getTransferStatus } from "@/lib/paymongo-transfers";

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

  const snap = await db
    .collection("withdrawalRequests")
    .where("paymongoTransferId", "==", transferId)
    .limit(1)
    .get();

  if (snap.empty) return false;

  const update: Record<string, unknown> = {
    paymongoTransferStatus: status,
  };

  if (status === "failed") {
    update.payError = failureMessage ?? "Transfer failed";
    update.payoutInFlight = false;
  } else if (status === "succeeded") {
    update.payError = FieldValue.delete();
  }

  await snap.docs[0].ref.update(update);
  return true;
}
