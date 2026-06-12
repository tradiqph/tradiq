import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { buildLiabilityCalendar } from "@/lib/console/liability-calendar";
import { manilaCurrentMonthKey, parseMonthParam } from "@/lib/manila-time";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const monthParam = request.nextUrl.searchParams.get("month");
    const monthKey = parseMonthParam(monthParam) ?? manilaCurrentMonthKey();
    const calendar = await buildLiabilityCalendar(auth.db, monthKey);
    return NextResponse.json(calendar);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load liability calendar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
