import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import {
  initiateWithdrawalPayout,
  WithdrawalPayoutError,
} from "@/lib/console/withdrawal-payout";
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
    const result = await initiateWithdrawalPayout(auth.db, {
      requestId,
      adminUid: auth.decoded.uid,
    });

    console.info(
      `[console/withdrawals/pay] ${auth.decoded.email} paid ${requestId} → ${result.transferId} (${result.centavos} centavos)`
    );

    return NextResponse.json({
      success: true,
      transferId: result.transferId,
      status: result.status,
    });
  } catch (err) {
    if (err instanceof WithdrawalPayoutError) {
      const status =
        err.code === "not_found"
          ? 404
          : err.code === "conflict"
            ? 409
            : err.code === "config"
              ? 503
              : 400;
      return NextResponse.json({ error: err.message }, { status });
    }

    return apiError(
      "console/withdrawals/pay",
      err,
      500,
      "Failed to initiate payout"
    );
  }
}
