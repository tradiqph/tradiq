import { fulfillPaidDeposit } from "@/lib/deposit-fulfillment";
import { getAdminDb } from "@/lib/firebase/admin";
import { getPaymentIntentStatus, isPaymongoTestMode } from "@/lib/paymongo";

const FULFILL_FUNCTION_URL =
  process.env.FULFILL_DEPOSIT_FUNCTION_URL ??
  "https://asia-southeast1-tradiq-f4962.cloudfunctions.net/fulfillDeposit";

export interface ClaimDepositResult {
  intentStatus: string;
  paid: boolean;
  synced: boolean;
  fulfillLocally?: boolean;
  error?: string;
}

export async function claimDepositPayment(
  intentId: string,
  depositId: string | undefined,
  idToken: string
): Promise<ClaimDepositResult> {
  const intentStatus = await getPaymentIntentStatus(intentId);
  const paid = intentStatus === "succeeded";

  if (!paid) {
    return { intentStatus, paid: false, synced: false };
  }

  const db = getAdminDb();
  if (db) {
    const synced = await fulfillPaidDeposit(db, intentId, depositId);
    return { intentStatus, paid: true, synced };
  }

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
    // Fall through to local test fulfillment
  }

  if (isPaymongoTestMode()) {
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
    error:
      "Payment confirmed by Paymongo. Add FIREBASE_ADMIN_SERVICE_ACCOUNT to .env.local to sync balances.",
  };
}
