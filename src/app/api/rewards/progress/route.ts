import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { loadRewardProgress } from "@/lib/rewards/claims-server";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitCheck = checkRateLimit({
    scope: "rewards-progress",
    key: decoded.uid,
    limit: 30,
    windowSec: 60,
  });

  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(limitCheck.retryAfterSec) },
      }
    );
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 }
    );
  }

  try {
    const data = await loadRewardProgress(db, decoded.uid);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load reward progress";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
