export const MANILA_TZ = "Asia/Manila";

export function manilaDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function manilaTodayKey(): string {
  return manilaDateKey(new Date());
}

const PAYOUT_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parsePayoutDayParam(value: string | null): string | undefined {
  if (!value || !PAYOUT_DAY_RE.test(value)) return undefined;
  return value;
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

export const LIABILITY_CALENDAR_MIN_MONTH = "2024-01";

export function manilaCurrentMonthKey(): string {
  return manilaDateKey(new Date()).slice(0, 7);
}

export function parseMonthParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [y, m] = value.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function getManilaMonthWindow(monthKey: string): {
  startKey: string;
  endKey: string;
  keys: string[];
  todayKey: string;
  monthKey: string;
} {
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();
  const keys: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    keys.push(`${monthKey}-${String(d).padStart(2, "0")}`);
  }
  return {
    startKey: keys[0]!,
    endKey: keys[keys.length - 1]!,
    keys,
    todayKey: manilaDateKey(new Date()),
    monthKey,
  };
}

export function addManilaMonths(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1, 12, 0, 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatManilaMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, 1, 12, 0, 0)));
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
