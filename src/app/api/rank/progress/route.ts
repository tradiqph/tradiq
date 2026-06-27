import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { loadRankProgressResponse } from "@/lib/ranks/metrics";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitCheck = checkRateLimit({
    scope: "rank-progress",
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
    const data = await loadRankProgressResponse(db, decoded.uid);
    return NextResponse.json({
      currentRank: data.currentRank,
      currentBadge: data.currentBadge,
      ranks: data.ranks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load rank progress";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
