import { FieldValue, Firestore, Timestamp } from "firebase-admin/firestore";
import { getAdminStorageBucket } from "@/lib/firebase/admin";
import type {
  SupportNotificationItem,
  SupportTicket,
  SupportTicketReply,
  SupportUnreadItem,
} from "@/lib/support";

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

function timestampToMillis(
  value: FirebaseFirestore.Timestamp | undefined | null
): number {
  if (!value || typeof value.toMillis !== "function") return 0;
  return value.toMillis();
}

export function isSupportTicketUnreadForUser(
  data: FirebaseFirestore.DocumentData
): boolean {
  const lastReplyAt = data.lastReplyAt as FirebaseFirestore.Timestamp | undefined;
  if (!lastReplyAt) return false;

  const authorRole = data.lastReplyAuthorRole as string | undefined;
  if (authorRole === "user") return false;
  if (authorRole !== "admin") {
    if (!data.lastReplyPreview) return false;
  }

  const userReadAt = data.userReadAt as FirebaseFirestore.Timestamp | undefined;
  if (!userReadAt) return true;

  return timestampToMillis(lastReplyAt) > timestampToMillis(userReadAt);
}

function hasAdminSupportReply(data: FirebaseFirestore.DocumentData): boolean {
  const lastReplyAt = data.lastReplyAt as FirebaseFirestore.Timestamp | undefined;
  if (!lastReplyAt) return false;

  const authorRole = data.lastReplyAuthorRole as string | undefined;
  if (authorRole === "user") return false;
  if (authorRole !== "admin" && !data.lastReplyPreview) return false;

  return true;
}

function toSupportNotificationItem(
  doc: FirebaseFirestore.QueryDocumentSnapshot
): SupportNotificationItem {
  const data = doc.data();
  return {
    ticketId: doc.id,
    categoryLabel: (data.categoryLabel as string) ?? "Support",
    preview: (data.lastReplyPreview as string) ?? "",
    lastReplyAt: serializeTimestamp(
      data.lastReplyAt as FirebaseFirestore.Timestamp | undefined
    ),
    isUnread: isSupportTicketUnreadForUser(data),
  };
}

export async function listSupportNotificationItemsForUser(
  db: Firestore,
  userId: string,
  limit = 20
): Promise<SupportNotificationItem[]> {
  const snap = await db
    .collection("supportTickets")
    .where("userId", "==", userId)
    .get();

  return snap.docs
    .filter((doc) => hasAdminSupportReply(doc.data()))
    .map(toSupportNotificationItem)
    .sort(
      (a, b) =>
        (b.lastReplyAt?.seconds ?? 0) - (a.lastReplyAt?.seconds ?? 0)
    )
    .slice(0, limit);
}

export async function markSupportTicketsReadForUser(
  db: Firestore,
  userId: string,
  ticketIds?: string[]
): Promise<number> {
  const snap = await db
    .collection("supportTickets")
    .where("userId", "==", userId)
    .get();

  const batch = db.batch();
  let updated = 0;

  for (const doc of snap.docs) {
    if (ticketIds && ticketIds.length > 0 && !ticketIds.includes(doc.id)) {
      continue;
    }
    if (!isSupportTicketUnreadForUser(doc.data())) continue;

    batch.update(doc.ref, {
      userReadAt: FieldValue.serverTimestamp(),
    });
    updated += 1;
  }

  if (updated > 0) {
    await batch.commit();
  }

  return updated;
}

export async function listUnreadSupportTicketsForUser(
  db: Firestore,
  userId: string
): Promise<SupportUnreadItem[]> {
  const items = await listSupportNotificationItemsForUser(db, userId);
  return items
    .filter((item) => item.isUnread)
    .map(({ isUnread: _isUnread, ...item }) => item);
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
    lastReplyAuthorRole: data.lastReplyAuthorRole ?? null,
    lastReplyPreview: (data.lastReplyPreview as string | undefined) ?? null,
    lastReplyAt: serializeTimestamp(data.lastReplyAt),
    userReadAt: serializeTimestamp(data.userReadAt),
    hasUnreadReply: isSupportTicketUnreadForUser(data),
  };

  if (includeReplies && db) {
    const repliesSnap = await doc.ref
      .collection("replies")
      .orderBy("createdAt", "asc")
      .get();
    ticket.replies = await Promise.all(
      repliesSnap.docs.map(async (r) => {
        const d = r.data();
        const attachmentPaths = (d.attachmentPaths as string[] | undefined) ?? [];
        return {
          id: r.id,
          authorId: d.authorId,
          authorRole: d.authorRole,
          authorEmail: d.authorEmail,
          body: d.body,
          attachmentPaths,
          attachmentUrls: await signedUrlsForPaths(attachmentPaths),
          createdAt: serializeTimestamp(d.createdAt),
        } satisfies SupportTicketReply;
      })
    );
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
    attachmentPaths?: string[];
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
    const attachmentPaths = reply.attachmentPaths ?? [];
    tx.set(replyRef, {
      authorId: reply.authorId,
      authorRole: reply.authorRole,
      authorEmail: reply.authorEmail ?? null,
      body: reply.body,
      attachmentPaths,
      createdAt: FieldValue.serverTimestamp(),
    });

    const preview =
      reply.body.trim() ||
      (attachmentPaths.length > 0 ? "Sent an attachment" : "");

    tx.update(ticketRef, {
      updatedAt: FieldValue.serverTimestamp(),
      lastReplyAt: FieldValue.serverTimestamp(),
      lastReplyPreview: preview.slice(0, 120),
      lastReplyAuthorRole: reply.authorRole,
    });
  });
}
