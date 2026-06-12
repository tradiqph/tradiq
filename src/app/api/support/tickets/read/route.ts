import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { markSupportTicketsReadForUser } from "@/lib/support-tickets";
import { apiError } from "@/lib/security/api-errors";

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  let ticketIds: string[] | undefined;
  try {
    const body = await request.json().catch(() => null);
    if (
      body &&
      typeof body === "object" &&
      "ticketIds" in body &&
      Array.isArray((body as { ticketIds: unknown }).ticketIds)
    ) {
      ticketIds = (body as { ticketIds: string[] }).ticketIds.filter(
        (id) => typeof id === "string" && id.length > 0
      );
    }
  } catch {
    ticketIds = undefined;
  }

  try {
    const updated = await markSupportTicketsReadForUser(
      db,
      decoded.uid,
      ticketIds
    );
    return NextResponse.json({ updated });
  } catch (e) {
    return apiError(
      "support/tickets/read POST",
      e,
      500,
      "Failed to mark support as read"
    );
  }
}
