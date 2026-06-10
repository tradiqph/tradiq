export const PRODUCTION_APP_URL = "https://www.tradiq.biz";

/** Strip trailing slash from a base URL. */
function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * Canonical URL for referral share links — always the live site,
 * regardless of whether the user is on localhost or a preview deploy.
 */
export function getReferralBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured && !configured.includes("localhost")) {
    return normalizeBaseUrl(configured);
  }
  return PRODUCTION_APP_URL;
}

/**
 * Resolves the public app base URL for general use (redirects, etc.).
 * In the browser, uses the current origin so dev/preview stay on the same host.
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
  return `${getReferralBaseUrl()}/register?ref=${code}`;
}

/**
 * Firebase action links (password reset, etc.) require an authorized domain.
 * Localhost is often not allowlisted, so use the live site when developing locally.
 */
export function getAuthActionContinueUrl(path = "/login"): string {
  const base = getReferralBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
