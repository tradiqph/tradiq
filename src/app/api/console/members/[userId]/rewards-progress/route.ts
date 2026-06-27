import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import {
  loadRewardProgress,
} from "@/lib/rewards/claims-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userId } = await params;
  const rootSnap = await auth.db.collection("users").doc(userId).get();
  if (!rootSnap.exists) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const rootData = rootSnap.data()!;

  try {
    const progress = await loadRewardProgress(auth.db, userId);

    return NextResponse.json({
      member: {
        id: userId,
        displayName: rootData.displayName ?? "",
        email: rootData.email ?? "",
      },
      groupSales: progress.groupSales,
      lifetimeGroupSales: progress.lifetimeGroupSales,
      claimedRewardTiers: progress.claimedRewardTiers,
      tiers: progress.tiers,
      metrics: progress.metrics,
      currentRank: progress.currentRank,
      currentBadge: progress.currentBadge,
      claims: progress.claims,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load rewards progress";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
