import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { listSupportNotificationItemsForUser } from "@/lib/support-tickets";
import { apiError } from "@/lib/security/api-errors";

export async function GET(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  try {
    const items = await listSupportNotificationItemsForUser(db, decoded.uid);
    const count = items.filter((item) => item.isUnread).length;
    return NextResponse.json({
      count,
      items,
    });
  } catch (e) {
    return apiError("support/unread GET", e, 500, "Failed to load unread support");
  }
}
