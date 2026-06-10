import { getAuthActionContinueUrl } from "@/lib/app-url";

/** Extract oobCode from a Firebase-generated password reset link. */
export function extractPasswordResetCode(firebaseLink: string): string | null {
  try {
    const url = new URL(firebaseLink);
    return url.searchParams.get("oobCode");
  } catch {
    return null;
  }
}

/** Build a branded TradIQ reset URL (tradiq.biz) from a Firebase admin link. */
export function buildBrandedPasswordResetLink(firebaseLink: string): string {
  const oobCode = extractPasswordResetCode(firebaseLink);
  if (!oobCode) {
    throw new Error("Invalid password reset link: missing code");
  }

  const base = getAuthActionContinueUrl("/reset-password");
  const url = new URL(base);
  url.searchParams.set("oobCode", oobCode);
  return url.toString();
}
