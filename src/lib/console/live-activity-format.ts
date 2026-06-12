/** Presentation-only base AUM for Live Activity overlay. */
export const PRESENTATION_AUM_BASE_PHP = 55_984_434;

/** @deprecated Use PRESENTATION_AUM_BASE_PHP */
export const PRESENTATION_AUM_PHP = PRESENTATION_AUM_BASE_PHP;

/** Display-only PHP/USDT rate — not used in real finance flows. */
export const PRESENTATION_PHP_PER_USDT = 58;

/** Display-only USD profit → PHP AUM bump. */
export const PRESENTATION_USD_TO_PHP = 58;

export function usdProfitToPhp(usd: number): number {
  return Math.round(usd * PRESENTATION_USD_TO_PHP * 100) / 100;
}

export function phpToPresentationUsdt(php: number): number {
  return Math.round((php / PRESENTATION_PHP_PER_USDT) * 100) / 100;
}

export function formatPresentationPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatLogTime(date: Date = new Date()): string {
  return date.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

export function displayInvestorName(displayName: string, email: string): string {
  const name = displayName?.trim();
  if (name) return name;
  return maskEmail(email);
}
