import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { isOwnedAttachmentPath } from "@/lib/support-attachments";
import {
  createTicketSchema,
  getCategoryLabel,
  sanitizeSupportText,
  SUPPORT_MAX_SUBJECT_LENGTH,
  type SupportCategory,
} from "@/lib/support";
import { serializeTicket } from "@/lib/support-tickets";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const status = request.nextUrl.searchParams.get("status") ?? "open";

  try {
    // Single-field query only — no composite index required while indexes build.
    const snap = await db
      .collection("supportTickets")
      .where("userId", "==", decoded.uid)
      .get();

    const docs = snap.docs
      .filter((doc) => {
        if (status !== "open" && status !== "resolved") return true;
        return doc.data().status === status;
      })
      .sort((a, b) => {
        const aMs = a.data().createdAt?.toMillis?.() ?? 0;
        const bMs = b.data().createdAt?.toMillis?.() ?? 0;
        return bMs - aMs;
      })
      .slice(0, 20);

    const tickets = await Promise.all(
      docs.map((doc) => serializeTicket(doc, true, db))
    );

    return NextResponse.json({ tickets });
  } catch (e) {
    return apiError("support/tickets GET", e, 500, "Failed to load tickets");
  }
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
    scope: "support-create",
    key: `${decoded.uid}:${ip}`,
    limit: 5,
    windowSec: 3600,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many support requests. Try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiBadRequest("Invalid JSON body");
  }

  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return apiBadRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  }

  const { category, message, attachmentPaths = [] } = parsed.data;
  const subjectRaw = parsed.data.subject?.trim();

  for (const path of attachmentPaths) {
    if (!isOwnedAttachmentPath(path, decoded.uid)) {
      return apiBadRequest("Invalid attachment");
    }
  }

  const userSnap = await db.collection("users").doc(decoded.uid).get();
  if (!userSnap.exists) {
    return apiBadRequest("User profile not found");
  }
  const userData = userSnap.data()!;

  const cleanMessage = sanitizeSupportText(message, 2000);
  const cleanSubject = subjectRaw
    ? sanitizeSupportText(subjectRaw, SUPPORT_MAX_SUBJECT_LENGTH)
    : null;

  if (category === "other" && !cleanSubject) {
    return apiBadRequest("Please enter a subject for Other concerns");
  }

  try {
    const ticketRef = db.collection("supportTickets").doc();
    await ticketRef.set({
      userId: decoded.uid,
      userEmail: userData.email ?? decoded.email ?? "",
      userDisplayName: userData.displayName ?? "User",
      category: category as SupportCategory,
      categoryLabel: getCategoryLabel(category as SupportCategory),
      subject: cleanSubject,
      message: cleanMessage,
      status: "open",
      attachmentPaths,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      resolvedAt: null,
      lastReplyAt: null,
      lastReplyPreview: null,
      lastReplyAuthorRole: null,
      userReadAt: FieldValue.serverTimestamp(),
    });

    const created = await ticketRef.get();
    const ticket = await serializeTicket(created, false, db);

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (e) {
    return apiError("support/tickets POST", e, 500, "Failed to create ticket");
  }
}
