export const MANILA_TZ = "Asia/Manila";

export function manilaDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addManilaDays(fromKey: string, days: number): string {
  const [y, m, d] = fromKey.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + days);
  return manilaDateKey(base);
}

export function formatManilaDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
}

export function getManilaDateWindow(horizonDays: number): {
  startKey: string;
  endKey: string;
  keys: string[];
  todayKey: string;
} {
  const todayKey = manilaDateKey(new Date());
  const keys = [todayKey];
  let current = todayKey;
  for (let i = 1; i < horizonDays; i++) {
    current = addManilaDays(current, 1);
    keys.push(current);
  }
  return {
    startKey: todayKey,
    endKey: keys[keys.length - 1]!,
    keys,
    todayKey,
  };
}

export function isManilaToday(value: unknown): boolean {
  if (!value) return false;

  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    date = (value as { toDate: () => Date }).toDate();
  } else if (typeof (value as { seconds?: number }).seconds === "number") {
    date = new Date((value as { seconds: number }).seconds * 1000);
  }

  if (!date || Number.isNaN(date.getTime())) return false;
  return manilaDateKey(date) === manilaDateKey(new Date());
}

export function toDateFromUnknown(
  value: unknown
): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof (value as { seconds?: number }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
}
