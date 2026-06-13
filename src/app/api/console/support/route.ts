import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Query } from "firebase-admin/firestore";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import {
  adminReplySchema,
  adminResolveSchema,
  sanitizeSupportText,
} from "@/lib/support";
import {
  appendReply,
  manilaDayBounds,
  serializeTicket,
  todayManilaDateString,
} from "@/lib/support-tickets";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { db } = auth;
  const params = request.nextUrl.searchParams;
  const date =
    params.get("date")?.trim() || todayManilaDateString();
  const status = params.get("status") ?? "all";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const cursor = params.get("cursor")?.trim() || null;

  const dateIsAll = date === "all";
  if (!dateIsAll && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return apiBadRequest("Invalid date format");
  }

  try {
    let query: Query;

    if (dateIsAll) {
      if (status === "open" || status === "resolved") {
        query = db
          .collection("supportTickets")
          .where("status", "==", status)
          .orderBy("createdAt", "desc")
          .limit(PAGE_SIZE + 1);
      } else {
        query = db
          .collection("supportTickets")
          .orderBy("createdAt", "desc")
          .limit(PAGE_SIZE + 1);
      }
    } else {
      const { start, end } = manilaDayBounds(date);

      if (status === "open" || status === "resolved") {
        query = db
          .collection("supportTickets")
          .where("status", "==", status)
          .where("createdAt", ">=", start)
          .where("createdAt", "<", end)
          .orderBy("createdAt", "desc")
          .limit(PAGE_SIZE + 1);
      } else {
        query = db
          .collection("supportTickets")
          .where("createdAt", ">=", start)
          .where("createdAt", "<", end)
          .orderBy("createdAt", "desc")
          .limit(PAGE_SIZE + 1);
      }
    }

    if (cursor) {
      const cursorDoc = await db.collection("supportTickets").doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snap = await query.get();
    const hasMore = snap.docs.length > PAGE_SIZE;
    const docs = hasMore ? snap.docs.slice(0, PAGE_SIZE) : snap.docs;

    const tickets = await Promise.all(
      docs.map((doc) => serializeTicket(doc, false, db))
    );

    return NextResponse.json({
      tickets,
      page,
      pageSize: PAGE_SIZE,
      hasMore,
      nextCursor: hasMore ? docs[docs.length - 1]?.id ?? null : null,
      date,
      status,
    });
  } catch (e) {
    return apiError("console/support GET", e, 500, "Failed to load tickets");
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { db, decoded } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiBadRequest("Invalid JSON body");
  }

  const action =
    typeof body === "object" && body !== null && "action" in body
      ? String((body as { action: unknown }).action)
      : "";

  try {
    if (action === "reply") {
      const parsed = adminReplySchema.safeParse(body);
      if (!parsed.success) {
        return apiBadRequest(parsed.error.issues[0]?.message ?? "Invalid reply");
      }

      const message = sanitizeSupportText(parsed.data.message, 2000);
      await appendReply(db, parsed.data.ticketId, {
        authorId: decoded.uid,
        authorRole: "admin",
        authorEmail: decoded.email,
        body: message,
      });

      const ticket = await serializeTicket(
        await db.collection("supportTickets").doc(parsed.data.ticketId).get(),
        true,
        db
      );
      return NextResponse.json({ ticket });
    }

    if (action === "resolve") {
      const parsed = adminResolveSchema.safeParse(body);
      if (!parsed.success) {
        return apiBadRequest("Invalid request");
      }

      const ticketRef = db.collection("supportTickets").doc(parsed.data.ticketId);
      const snap = await ticketRef.get();
      if (!snap.exists) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }
      if (snap.data()?.status === "resolved") {
        return apiBadRequest("Ticket is already resolved");
      }

      await ticketRef.update({
        status: "resolved",
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: decoded.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const ticket = await serializeTicket(await ticketRef.get(), true, db);
      return NextResponse.json({ ticket });
    }

    return apiBadRequest("Unknown action");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Ticket not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg === "Ticket is already resolved") {
      return apiBadRequest(msg);
    }
    return apiError("console/support PATCH", e, 500, "Failed to update ticket");
  }
}
