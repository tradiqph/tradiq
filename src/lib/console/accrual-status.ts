import { Firestore } from "firebase-admin/firestore";

const STALE_MS = 30 * 60 * 1000;

export interface AccrualStatus {
  lastRunAt: string | null;
  dueCount: number;
  processedCount: number;
  source: string | null;
  stale: boolean;
}

export async function getAccrualStatus(
  db: Firestore
): Promise<AccrualStatus | null> {
  const snap = await db.collection("platform").doc("accrual").get();
  if (!snap.exists) {
    return {
      lastRunAt: null,
      dueCount: 0,
      processedCount: 0,
      source: null,
      stale: true,
    };
  }

  const data = snap.data()!;
  const lastRunAt = data.lastRunAt?.toDate?.()?.toISOString() ?? null;
  const stale = !lastRunAt || Date.now() - new Date(lastRunAt).getTime() > STALE_MS;

  return {
    lastRunAt,
    dueCount: (data.dueCount as number) ?? 0,
    processedCount: (data.processedCount as number) ?? 0,
    source: (data.source as string) ?? null,
    stale,
  };
}
