import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { serializeTicket } from "@/lib/support-tickets";
import { apiError } from "@/lib/security/api-errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  if (!id || id.length > 128) {
    return NextResponse.json({ error: "Invalid ticket id" }, { status: 400 });
  }

  try {
    const doc = await auth.db.collection("supportTickets").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const ticket = await serializeTicket(doc, true, auth.db);
    return NextResponse.json({ ticket });
  } catch (e) {
    return apiError("console/support/[id]", e, 500, "Failed to load ticket");
  }
}
