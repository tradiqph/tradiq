import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { fetchSubscriptionCommissions } from "@/lib/console/commissions";

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

  try {
    const result = await fetchSubscriptionCommissions(auth.db, status);
    return NextResponse.json(result);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load commissions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
