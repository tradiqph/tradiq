import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { trackReferralSignup } from "@/lib/referral-payout";

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

  try {
    await trackReferralSignup(db, decoded.uid);
    return NextResponse.json({ success: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to track referral signup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
