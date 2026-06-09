import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { fetchAllInvestments } from "@/lib/console/aggregate-stats";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status =
    (request.nextUrl.searchParams.get("status") as
      | "active"
      | "completed"
      | "all") ?? "all";
  const dueToday = request.nextUrl.searchParams.get("dueToday") === "true";

  const result = await fetchAllInvestments(auth.db, status, dueToday);
  return NextResponse.json(result);
}
