import { Firestore, Query } from "firebase-admin/firestore";
import {
  manilaDayBounds,
  todayManilaDateString,
} from "@/lib/support-tickets";

async function runCount(query: Query): Promise<number> {
  try {
    const snap = await query.count().get();
    return snap.data().count;
  } catch {
    const snap = await query.get();
    return snap.size;
  }
}

/** All unresolved (open) support tickets — used for console nav badge. */
export async function countOpenSupportTickets(db: Firestore): Promise<number> {
  return runCount(
    db.collection("supportTickets").where("status", "==", "open")
  );
}

/** Open tickets created on a specific Manila calendar day. */
export async function countOpenSupportTicketsForDate(
  db: Firestore,
  date = todayManilaDateString()
): Promise<number> {
  const { start, end } = manilaDayBounds(date);

  return runCount(
    db
      .collection("supportTickets")
      .where("status", "==", "open")
      .where("createdAt", ">=", start)
      .where("createdAt", "<", end)
  );
}

export async function countOpenSupportTicketsToday(
  db: Firestore,
  date = todayManilaDateString()
): Promise<number> {
  return countOpenSupportTicketsForDate(db, date);
}
