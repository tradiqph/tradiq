import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { loadRankProgressResponse } from "@/lib/ranks/metrics";

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
    const progress = await loadRankProgressResponse(auth.db, userId);

    return NextResponse.json({
      member: {
        id: userId,
        displayName: rootData.displayName ?? "",
        email: rootData.email ?? "",
      },
      currentRank: progress.currentRank,
      currentBadge: progress.currentBadge,
      rankActivatedAt: progress.rankActivatedAt,
      metrics: progress.metrics,
      ranks: progress.ranks,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load rank progress";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
