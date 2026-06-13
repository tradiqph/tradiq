import { NextRequest, NextResponse } from "next/server";
import type { DocumentReference } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { sanitizeSupportText, userReplySchema } from "@/lib/support";
import { appendReply, serializeTicket } from "@/lib/support-tickets";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

async function ticketHasAdminReply(
  ticketRef: DocumentReference
): Promise<boolean> {
  const snap = await ticketRef
    .collection("replies")
    .where("authorRole", "==", "admin")
    .limit(1)
    .get();
  return !snap.empty;
}

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit({
    scope: "support-reply",
    key: `${decoded.uid}:${ip}`,
    limit: 20,
    windowSec: 3600,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many replies. Try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiBadRequest("Invalid JSON body");
  }

  const parsed = userReplySchema.safeParse(body);
  if (!parsed.success) {
    return apiBadRequest(parsed.error.issues[0]?.message ?? "Invalid reply");
  }

  const { ticketId } = parsed.data;
  const message = sanitizeSupportText(parsed.data.message, 2000);
  if (!message) {
    return apiBadRequest("Message cannot be empty");
  }

  try {
    const ticketRef = db.collection("supportTickets").doc(ticketId);
    const ticketSnap = await ticketRef.get();

    if (!ticketSnap.exists) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const ticketData = ticketSnap.data()!;
    if (ticketData.userId !== decoded.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (ticketData.status === "resolved") {
      return apiBadRequest("This ticket is resolved");
    }

    if (!(await ticketHasAdminReply(ticketRef))) {
      return apiBadRequest(
        "You can reply after Support has responded to your ticket"
      );
    }

    await appendReply(db, ticketId, {
      authorId: decoded.uid,
      authorRole: "user",
      authorEmail: decoded.email,
      body: message,
    });

    const ticket = await serializeTicket(await ticketRef.get(), true, db);
    return NextResponse.json({ ticket });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Ticket not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg === "Ticket is already resolved") {
      return apiBadRequest(msg);
    }
    return apiError("support/tickets/reply POST", e, 500, "Failed to send reply");
  }
}
