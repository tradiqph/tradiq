import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { aggregateConsoleStats } from "@/lib/console/aggregate-stats";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const stats = await aggregateConsoleStats(auth.db);
    return NextResponse.json(stats);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load dashboard stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
