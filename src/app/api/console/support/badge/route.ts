import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import {
  countOpenSupportTickets,
  countOpenSupportTicketsForDate,
} from "@/lib/console/support-badge";
import { todayManilaDateString } from "@/lib/support-tickets";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const scope = request.nextUrl.searchParams.get("scope") ?? "today";
    const date = request.nextUrl.searchParams.get("date")?.trim();

    if (scope === "today") {
      const day =
        date && /^\d{4}-\d{2}-\d{2}$/.test(date)
          ? date
          : todayManilaDateString();
      const count = await countOpenSupportTicketsForDate(auth.db, day);
      return NextResponse.json({ openCount: count, scope: "today", date: day });
    }

    const count = await countOpenSupportTickets(auth.db);
    return NextResponse.json({
      openCount: count,
      scope: "all",
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load support badge";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
