import { createSeededRng } from "@/lib/bot-chart-seed";
import { BOTS_CATALOG_SEED } from "@/lib/bots-catalog";
import type { LiveActivityLogEntry, TradeLogKind } from "@/components/console/live-activity/live-activity-types";

const BOT_NAMES = BOTS_CATALOG_SEED.map((b) => b.name);
const TOKENS = ["SOL", "BNB", "ETH", "AVAX", "RAY", "WIF", "JUP", "TRUMP", "ZEST", "SLX"];
const POOLS = ["BSC liquidity pools", "SOL/USDT pairs", "RAY pools", "DEX pairs", "mid-cap alts"];

let seq = 0;

function nextId(): string {
  seq += 1;
  return `sim-${Date.now()}-${seq}`;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function fmtQty(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(n: number): string {
  return n.toFixed(2);
}

function randomProfit(rng: () => number): { profit: number; pct: number } {
  const roll = rng();
  let profit: number;
  if (roll < 0.6) {
    profit = 1000 + rng() * 9000;
  } else if (roll < 0.9) {
    profit = 10_000 + rng() * 90_000;
  } else {
    profit = 100_000 + rng() * 899_999;
  }
  return {
    profit: Math.round(profit * 100) / 100,
    pct: 0.06 + rng() * 0.32,
  };
}

function randomNotional(rng: () => number): { qty: number; price: number; usd: number } {
  const usd = 50_000 + rng() * 800_000;
  const price = 0.05 + rng() * 4.5;
  const qty = usd / price;
  return { qty, price, usd };
}

export function createSimulatorRng(seed: number): () => number {
  return createSeededRng(seed);
}

export function generateTradeLog(
  rng: () => number,
  kind?: TradeLogKind
): LiveActivityLogEntry {
  const bot = pick(rng, BOT_NAMES);
  const token = pick(rng, TOKENS);
  const now = new Date();

  const roll = kind ?? pick(rng, [
    "SCAN",
    "SCAN",
    "SCAN",
    "MONITOR",
    "MONITOR",
    "SIGNAL",
    "ANALYZE",
    "BUY",
    "SELL",
    "EXECUTED",
    "PROFIT",
  ] as TradeLogKind[]);

  let message = "";
  let profitUsd: number | undefined;

  switch (roll) {
    case "SCAN":
      message = `: Sweeping ${pick(rng, POOLS)} for entry setups…`;
      break;
    case "MONITOR":
      message =
        rng() > 0.5
          ? `: Tracking momentum on ${token} — signal not confirmed`
          : `: Volatility below threshold — holding`;
      break;
    case "SIGNAL":
      message = `: Entry signal found — ${token}`;
      break;
    case "ANALYZE":
      message = `: Entry conditions met — ${token}/USDT @ ${fmtPct(0.01 + rng() * 0.35)}%`;
      break;
    case "BUY": {
      const { qty, price, usd } = randomNotional(rng);
      message = ` ${token} ${fmtQty(qty)} @ $${fmtPct(price)} ($${fmtUsd(usd)}) · ${bot}`;
      break;
    }
    case "SELL": {
      const { qty, price, usd } = randomNotional(rng);
      message = ` ${token} ${fmtQty(qty)} @ $${fmtPct(price)} ($${fmtUsd(usd)}) · ${bot}`;
      break;
    }
    case "EXECUTED":
      message = `: Trade confirmed on-chain · ${bot}`;
      break;
    case "PROFIT": {
      const { profit, pct } = randomProfit(rng);
      profitUsd = Math.round(profit * 100) / 100;
      message = ` +$${fmtUsd(profitUsd)} (+${fmtPct(pct)}%) · position closed · ${bot}`;
      break;
    }
    default:
      message = `: ${bot} active`;
  }

  return {
    id: nextId(),
    kind: roll,
    message,
    timestamp: now,
    isNew: true,
    profitUsd,
  };
}

/** BUY → EXECUTED → PROFIT chain for burst mode */
export function generateTradeBurst(rng: () => number): LiveActivityLogEntry[] {
  const bot = pick(rng, BOT_NAMES);
  const token = pick(rng, TOKENS);
  const { qty, price, usd } = randomNotional(rng);
  const { profit, pct } = randomProfit(rng);
  const profitUsd = profit;
  const base = Date.now();

  return [
    {
      id: nextId(),
      kind: "BUY",
      message: ` ${token} ${fmtQty(qty)} @ $${fmtPct(price)} ($${fmtUsd(usd)}) · ${bot}`,
      timestamp: new Date(base),
      isNew: true,
    },
    {
      id: nextId(),
      kind: "EXECUTED",
      message: `: Trade confirmed on-chain · ${bot}`,
      timestamp: new Date(base + 400),
      isNew: true,
    },
    {
      id: nextId(),
      kind: "PROFIT",
      message: ` +$${fmtUsd(profitUsd)} (+${fmtPct(Math.min(pct, 0.38))}%) · position closed · ${bot}`,
      timestamp: new Date(base + 900),
      isNew: true,
      profitUsd,
    },
  ];
}

export function randomIntervalMs(rng: () => number): number {
  return 1500 + Math.floor(rng() * 2500);
}

export function shouldBurst(rng: () => number): boolean {
  return rng() < 0.08;
}
