/** Presentation-only base AUM for Live Activity overlay. */
export const PRESENTATION_AUM_BASE_PHP = 55_984_434;

/** @deprecated Use PRESENTATION_AUM_BASE_PHP */
export const PRESENTATION_AUM_PHP = PRESENTATION_AUM_BASE_PHP;

/** Display-only PHP/USDT rate — not used in real finance flows. */
export const PRESENTATION_PHP_PER_USDT = 58;

/** Display-only USD profit → PHP AUM bump. */
export const PRESENTATION_USD_TO_PHP = 58;

/** Baseline trades executed shown in header at session start. */
export const PRESENTATION_TRADES_BASE = 14_218;

/** Baseline winning trades (~92.4% of PRESENTATION_TRADES_BASE). */
export const PRESENTATION_WINS_BASE = 13_137;

/** Win rate never displayed below this percentage. */
export const PRESENTATION_WIN_RATE_FLOOR = 91;

/** Presentation uptime anchor — May 20 2026 (~19 days on Jun 8 2026). */
export const PRESENTATION_UPTIME_START = new Date(2026, 4, 20);

const MS_PER_DAY = 86_400_000;

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

export function randomSessionPnlBase(seed: number): number {
  return 600 + (Math.abs(seed) % 1200);
}

export function computePresentationWinRate(
  winningTrades: number,
  tradesExecuted: number
): number {
  if (tradesExecuted <= 0) return 92.4;
  return Math.max(
    PRESENTATION_WIN_RATE_FLOOR,
    (winningTrades / tradesExecuted) * 100
  );
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getPresentationUptimeDays(now = new Date()): number {
  const start = startOfLocalDay(PRESENTATION_UPTIME_START);
  const today = startOfLocalDay(now);
  const days = Math.round((today.getTime() - start.getTime()) / MS_PER_DAY);
  return Math.max(1, days);
}

export function formatPresentationUptime(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function formatSessionPnlUsd(amount: number): string {
  if (amount >= 1000) {
    return amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
