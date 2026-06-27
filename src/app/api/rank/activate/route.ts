import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  getPreviousRank,
  getRankIndex,
  getRankTier,
  normalizeMemberRank,
  type PromotableRank,
} from "@/lib/ranks/config";
import { getRankBadge } from "@/lib/ranks/display";
import { loadRankMetrics } from "@/lib/ranks/metrics";
import { evaluateRankProgress } from "@/lib/ranks/progress";
import { checkRateLimit } from "@/lib/security/rate-limit";

const VALID_RANKS: PromotableRank[] = ["leader", "director", "ambassador"];

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitCheck = checkRateLimit({
    scope: "rank-activate",
    key: decoded.uid,
    limit: 5,
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rank =
    typeof body === "object" && body !== null && "rank" in body
      ? String((body as { rank: unknown }).rank)
      : "";

  if (!VALID_RANKS.includes(rank as PromotableRank)) {
    return NextResponse.json({ error: "Invalid rank" }, { status: 400 });
  }

  const targetRank = rank as PromotableRank;

  try {
    const userRef = db.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentRank = normalizeMemberRank(userSnap.data()?.memberRank);
    const previousRank = getPreviousRank(targetRank);

    if (getRankIndex(currentRank) >= getRankIndex(targetRank)) {
      return NextResponse.json(
        { error: "Rank already activated" },
        { status: 400 }
      );
    }

    if (
      previousRank !== "member" &&
      getRankIndex(currentRank) < getRankIndex(previousRank)
    ) {
      return NextResponse.json(
        {
          error: `Activate ${getRankTier(previousRank).label} first`,
        },
        { status: 400 }
      );
    }

    const { metrics } = await loadRankMetrics(db, decoded.uid);
    const progress = evaluateRankProgress(
      getRankTier(targetRank),
      metrics,
      currentRank
    );

    if (!progress.canActivate) {
      return NextResponse.json(
        {
          error: progress.disabledReason ?? "Requirements not met",
        },
        { status: 400 }
      );
    }

    await userRef.update({
      memberRank: targetRank,
      rankActivatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      memberRank: targetRank,
      badge: getRankBadge(targetRank),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to activate rank";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
