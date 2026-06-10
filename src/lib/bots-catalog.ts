import { BotCatalogItem } from "@/types";

export const BINANCE_COPY_TRADING_LEAD_BASE =
  "https://www.binance.com/en-PH/copy-trading/lead-details";

/** Vertex Flow — verified Binance copy-trading lead (30D performance). */
export const VERTEX_FLOW_BINANCE_LEAD_URL = `${BINANCE_COPY_TRADING_LEAD_BASE}/4920419848544780801?timeRange=30D`;

export function binanceLeadProfileUrl(
  leadId: string,
  timeRange: "7D" | "30D" | "90D" | "1Y" = "30D"
): string {
  return `${BINANCE_COPY_TRADING_LEAD_BASE}/${leadId}?timeRange=${timeRange}`;
}

export const BOTS_CATALOG_SEED: (BotCatalogItem & { id: string })[] = [
  {
    id: "aurum-pulse",
    name: "Aurum Pulse",
    strategy: "Scalp · High-frequency",
    description:
      "Rapid-entry signal bot tuned for short bursts on trending Solana pairs. Prioritizes tight stops and quick profit locks.",
    rank: 1,
    winRate: 98,
    pnl: "+$3.92M",
    volume: "$612.8M",
    trades: "481.2K",
    avgHold: "18m",
    isActive: false,
    avatarUrl: "/assets/bot-alpha-vault.png",
    walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuZZosgP9",
    weeklyPnl: "+$142K",
    lastSignal: "2m ago",
  },
  {
    id: "nexus-quant",
    name: "Nexus Quant",
    strategy: "Grid · Range-bound",
    description:
      "Systematic grid strategy that harvests volatility inside established price bands. Best in sideways markets.",
    rank: 2,
    winRate: 97,
    pnl: "+$2.44M",
    volume: "$388.5M",
    trades: "296.7K",
    avgHold: "32m",
    isActive: false,
    avatarUrl: "/assets/bot-precision.png",
    walletAddress: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    weeklyPnl: "+$89K",
    lastSignal: "8m ago",
  },
  {
    id: "velocity-core",
    name: "Velocity Core",
    strategy: "Momentum · Trend",
    description:
      "Follows breakout momentum across mid-cap tokens. Enters on volume spikes and trails winners with dynamic exits.",
    rank: 3,
    winRate: 94,
    pnl: "+$1.67M",
    volume: "$271.3M",
    trades: "218.4K",
    avgHold: "1h 12m",
    isActive: false,
    avatarUrl: "/assets/bot-momentum.png",
    walletAddress: "DYw8jCTfwHNRJhhmFcbXvVDVqLU5oHpD5hG8kW2jE1wX",
    weeklyPnl: "+$61K",
    lastSignal: "14m ago",
  },
  {
    id: "vertex-flow",
    name: "Vertex Flow",
    strategy: "Multi-signal · Auto-switch",
    description:
      "TradIQ's flagship engine — rotates between top signals in real time and auto-calibrates to the strongest performer.",
    rank: 4,
    winRate: 99,
    pnl: "+$4.11M",
    volume: "$589.2M",
    trades: "367.9K",
    avgHold: "41m",
    isActive: true,
    avatarUrl: "/assets/bot-apex.png",
    walletAddress: "HN7cABqLq46Es1jh92dQQisAq662SmxAU7gSWZDZg5Jk",
    weeklyPnl: "+$178K",
    lastSignal: "Just now",
    binanceLeadUrl: VERTEX_FLOW_BINANCE_LEAD_URL,
  },
];

export function truncateWallet(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function solscanAccountUrl(address: string): string {
  return `https://solscan.io/account/${address}`;
}
