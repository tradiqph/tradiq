export const PRODUCTION_APP_URL = "https://tradiq-rose.vercel.app";

/** Strip trailing slash from a base URL. */
function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * Resolves the public app base URL for share links (referrals, etc.).
 * In the browser, always uses the current origin so links match the deployed domain.
 */
export function getAppBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return normalizeBaseUrl(configured);
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_APP_URL;
  }

  return "http://localhost:3000";
}

export function buildReferralLink(referralCode: string): string {
  if (!referralCode) return "";
  const code = encodeURIComponent(referralCode);
  return `${getAppBaseUrl()}/register?ref=${code}`;
}
