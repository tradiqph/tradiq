import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { fetchAllInvestments } from "@/lib/console/aggregate-stats";

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

  try {
    const result = await fetchAllInvestments(auth.db, status, dueToday);
    return NextResponse.json(result);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load investments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
