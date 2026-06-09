import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { aggregateConsoleStats } from "@/lib/console/aggregate-stats";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stats = await aggregateConsoleStats(auth.db);
  return NextResponse.json(stats);
}
