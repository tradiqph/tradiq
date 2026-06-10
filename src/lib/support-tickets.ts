import { FieldValue, Firestore, Timestamp } from "firebase-admin/firestore";
import { getAdminStorageBucket } from "@/lib/firebase/admin";
import type { SupportTicket, SupportTicketReply } from "@/lib/support";

export async function signedUrlsForPaths(
  paths: string[]
): Promise<string[]> {
  const bucket = getAdminStorageBucket();
  if (!bucket || paths.length === 0) return [];
  const urls: string[] = [];
  for (const path of paths) {
    try {
      const file = bucket.file(path);
      const [exists] = await file.exists();
      if (!exists) continue;
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 60 * 60 * 1000,
      });
      urls.push(url);
    } catch {
      // Skip missing files
    }
  }
  return urls;
}

function serializeTimestamp(
  value: FirebaseFirestore.Timestamp | undefined | null
): { seconds: number } | null {
  if (!value) return null;
  return { seconds: value.seconds };
}

export async function serializeTicket(
  doc: FirebaseFirestore.DocumentSnapshot,
  includeReplies = false,
  db?: Firestore
): Promise<SupportTicket> {
  const data = doc.data()!;
  const attachmentPaths = (data.attachmentPaths as string[]) ?? [];

  const ticket: SupportTicket = {
    id: doc.id,
    userId: data.userId,
    userEmail: data.userEmail,
    userDisplayName: data.userDisplayName,
    category: data.category,
    categoryLabel: data.categoryLabel,
    subject: data.subject ?? null,
    message: data.message,
    status: data.status,
    attachmentPaths,
    attachmentUrls: await signedUrlsForPaths(attachmentPaths),
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
    resolvedAt: serializeTimestamp(data.resolvedAt),
  };

  if (includeReplies && db) {
    const repliesSnap = await doc.ref
      .collection("replies")
      .orderBy("createdAt", "asc")
      .get();
    ticket.replies = repliesSnap.docs.map((r) => {
      const d = r.data();
      return {
        id: r.id,
        authorId: d.authorId,
        authorRole: d.authorRole,
        authorEmail: d.authorEmail,
        body: d.body,
        createdAt: serializeTimestamp(d.createdAt),
      } satisfies SupportTicketReply;
    });
  }

  return ticket;
}

export function manilaDayBounds(dateStr: string): {
  start: Timestamp;
  end: Timestamp;
} {
  const start = new Date(`${dateStr}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end),
  };
}

export function todayManilaDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(new Date());
}

export async function appendReply(
  db: Firestore,
  ticketId: string,
  reply: {
    authorId: string;
    authorRole: "user" | "admin";
    authorEmail?: string;
    body: string;
  }
) {
  const ticketRef = db.collection("supportTickets").doc(ticketId);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) throw new Error("Ticket not found");

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ticketRef);
    if (!fresh.exists) throw new Error("Ticket not found");
    if (fresh.data()?.status === "resolved") {
      throw new Error("Ticket is already resolved");
    }

    const replyRef = ticketRef.collection("replies").doc();
    tx.set(replyRef, {
      authorId: reply.authorId,
      authorRole: reply.authorRole,
      authorEmail: reply.authorEmail ?? null,
      body: reply.body,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.update(ticketRef, {
      updatedAt: FieldValue.serverTimestamp(),
      lastReplyAt: FieldValue.serverTimestamp(),
      lastReplyPreview: reply.body.slice(0, 120),
    });
  });
}
