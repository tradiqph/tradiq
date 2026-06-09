import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";
import { referralCodeSchema } from "@/lib/security/validation";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = checkRateLimit({
    scope: "referral-resolve",
    key: ip,
    limit: 30,
    windowSec: 60,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      }
    );
  }

  const rawCode = request.nextUrl.searchParams.get("code")?.trim();
  if (!rawCode) {
    return NextResponse.json({ valid: false });
  }

  const parsed = referralCodeSchema.safeParse(rawCode);
  if (!parsed.success) {
    return NextResponse.json({ valid: false });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 }
    );
  }

  const snap = await db
    .collection("users")
    .where("referralCode", "==", parsed.data)
    .limit(1)
    .get();

  return NextResponse.json({ valid: !snap.empty });
}
