import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { syncPendingDepositsForUser } from "@/lib/deposits-server";
import { apiError } from "@/lib/security/api-errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit({
    scope: "deposits-sync",
    key: `${decoded.uid}:${ip}`,
    limit: 30,
    windowSec: 300,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many sync requests" }, { status: 429 });
  }

  const authHeader = request.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  try {
    const result = await syncPendingDepositsForUser(decoded.uid, idToken);
    return NextResponse.json(result);
  } catch (e) {
    return apiError("deposits/sync-pending", e, 500, "Failed to sync deposits");
  }
}
