import { NextRequest, NextResponse } from "next/server";
import { getAccrualStatus } from "@/lib/console/accrual-status";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { fetchAllInvestments } from "@/lib/console/aggregate-stats";
import {
  manilaTodayKey,
  parsePayoutDayParam,
} from "@/lib/manila-time";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const status =
    (request.nextUrl.searchParams.get("status") as
      | "active"
      | "completed"
      | "all") ?? "all";
  const dueToday = request.nextUrl.searchParams.get("dueToday") === "true";
  const payoutDayParam = parsePayoutDayParam(
    request.nextUrl.searchParams.get("payoutDay")
  );
  const payoutDay = payoutDayParam ?? (dueToday ? manilaTodayKey() : undefined);

  try {
    const [result, accrualStatus] = await Promise.all([
      fetchAllInvestments(auth.db, status, { payoutDay }),
      getAccrualStatus(auth.db),
    ]);
    return NextResponse.json({ ...result, accrualStatus });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load investments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
