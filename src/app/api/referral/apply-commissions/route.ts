import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { validateBotSubscribeAmount } from "@/lib/finance";
import { getAdminDb } from "@/lib/firebase/admin";
import { applyReferralCommissions } from "@/lib/referral-payout";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";

/** Apply upline commissions after a client-side bot subscription (dev fallback). */
export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiBadRequest("Invalid JSON body");
  }

  const amount =
    typeof body === "object" && body !== null && "amount" in body
      ? Number((body as { amount: unknown }).amount)
      : NaN;

  const amountError = validateBotSubscribeAmount(amount);
  if (amountError) {
    return apiBadRequest(amountError);
  }

  try {
    await applyReferralCommissions(db, decoded.uid, amount);
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(
      "referral/apply-commissions",
      e,
      500,
      "Failed to apply referral commissions"
    );
  }
}
