import type { Firestore } from "firebase-admin/firestore";

export const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL?.trim() || "noreply@tradiq.biz";

export const RESEND_FROM_NAME = "TradIQ";

/** Default inbox for bot investment and withdrawal admin alerts. */
export const DEFAULT_ADMIN_NOTIFICATION_EMAIL = "tradiqph@gmail.com";

export function getResendFromAddress(): string {
  return `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`;
}

export function getResendApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function isResendConfigured(): boolean {
  return Boolean(getResendApiKey());
}

function parseAdminEmailsFromEnv(): string[] {
  const raw = process.env.ADMIN_NOTIFICATION_EMAILS?.trim();
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@"))
    ),
  ];
}

/** Recipients for internal alerts (bot investments, withdrawals, etc.). */
export async function getAdminNotificationRecipients(
  _db: Firestore | null
): Promise<string[]> {
  const fromEnv = parseAdminEmailsFromEnv();
  if (fromEnv.length > 0) return fromEnv;
  return [DEFAULT_ADMIN_NOTIFICATION_EMAIL];
}
