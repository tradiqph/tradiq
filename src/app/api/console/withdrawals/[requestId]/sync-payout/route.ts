import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import {
  syncWithdrawalPayoutForRequest,
  WithdrawalPayoutSyncError,
} from "@/lib/console/withdrawal-transfer-webhook";
import { apiError } from "@/lib/security/api-errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { requestId } = await params;
  if (!requestId || requestId.length > 128) {
    return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
  }

  try {
    const result = await syncWithdrawalPayoutForRequest(auth.db, requestId);

    console.info(
      `[console/withdrawals/sync-payout] ${auth.decoded.email} synced ${requestId} → ${result.transferId} (${result.status})`
    );

    return NextResponse.json({
      success: true,
      transferId: result.transferId,
      status: result.status,
      failureMessage: result.failureMessage,
      updated: result.updated,
    });
  } catch (err) {
    if (err instanceof WithdrawalPayoutSyncError) {
      const status = err.code === "not_found" ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }

    return apiError(
      "console/withdrawals/sync-payout",
      err,
      500,
      "Failed to sync payout status"
    );
  }
}
