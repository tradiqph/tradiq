import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { fetchLiveActivityInvestments } from "@/lib/console/live-activity-investments";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const investments = await fetchLiveActivityInvestments(
      auth.db,
      auth.decoded.uid
    );
    return NextResponse.json({ investments });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load live activity investments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
