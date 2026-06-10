import { fulfillPaidDeposit } from "@/lib/deposit-fulfillment";
import { getAdminDb } from "@/lib/firebase/admin";
import { getPaymentIntentStatus, isPaymongoTestMode } from "@/lib/paymongo";
import { isProduction } from "@/lib/security/env";

const FULFILL_FUNCTION_URL = process.env.FULFILL_DEPOSIT_FUNCTION_URL;

export interface ClaimDepositResult {
  intentStatus: string;
  paid: boolean;
  synced: boolean;
  fulfillLocally?: boolean;
  error?: string;
}

export async function syncPendingDepositsForUser(
  userId: string,
  idToken: string
): Promise<{ checked: number; synced: number }> {
  const db = getAdminDb();
  if (!db) {
    return { checked: 0, synced: 0 };
  }

  const snap = await db
    .collection("deposits")
    .where("userId", "==", userId)
    .get();

  const pending = snap.docs.filter((doc) => doc.data().status === "pending");
  let synced = 0;

  for (const doc of pending) {
    const intentId = doc.data().paymongoIntentId as string | undefined;
    if (!intentId) continue;

    const result = await claimDepositPayment(
      intentId,
      doc.id,
      idToken,
      userId
    );
    if (result.synced) synced += 1;
  }

  return { checked: pending.length, synced };
}

export async function claimDepositPayment(
  intentId: string,
  depositId: string | undefined,
  idToken: string,
  userId: string
): Promise<ClaimDepositResult> {
  const intentStatus = await getPaymentIntentStatus(intentId);
  const paid = intentStatus === "succeeded";

  if (!paid) {
    return { intentStatus, paid: false, synced: false };
  }

  const db = getAdminDb();
  if (db) {
    const synced = await fulfillPaidDeposit(
      db,
      intentId,
      depositId,
      userId
    );
    return { intentStatus, paid: true, synced };
  }

  if (FULFILL_FUNCTION_URL) {
    try {
      const res = await fetch(FULFILL_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ intentId, depositId }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.synced) {
        return { intentStatus, paid: true, synced: true };
      }
    } catch {
      // Fall through
    }
  }

  if (!isProduction() && isPaymongoTestMode()) {
    return {
      intentStatus,
      paid: true,
      synced: false,
      fulfillLocally: true,
    };
  }

  return {
    intentStatus,
    paid: true,
    synced: false,
    error: "Payment confirmed. Server sync is temporarily unavailable.",
  };
}
