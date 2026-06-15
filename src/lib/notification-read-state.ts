const READ_KEY = "tradiq_notifications_read_at";
const SEEN_IDS_KEY = "tradiq_notifications_seen_ids";
export const NOTIFICATION_SEEN_EVENT = "tradiq-notification-seen";

export function readSeenNotificationIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SEEN_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function persistSeenIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(READ_KEY, String(Date.now()));
  localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(ids));
}

export function markNotificationSeen(ids: string | string[]): void {
  if (typeof window === "undefined") return;

  const nextIds = Array.isArray(ids) ? ids : [ids];
  if (nextIds.length === 0) return;

  const merged = [...new Set([...readSeenNotificationIds(), ...nextIds])];
  persistSeenIds(merged);
  window.dispatchEvent(new CustomEvent(NOTIFICATION_SEEN_EVENT));
}
