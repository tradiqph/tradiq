export type LiveActivityTab = "all" | "trades" | "profits" | "investments";

export type TradeLogKind =
  | "SCAN"
  | "SIGNAL"
  | "ANALYZE"
  | "BUY"
  | "SELL"
  | "EXECUTED"
  | "PROFIT"
  | "MONITOR"
  | "SUB";

export interface LiveActivityLogEntry {
  id: string;
  kind: TradeLogKind;
  message: string;
  timestamp: Date;
  isNew?: boolean;
  /** Investment logs only — for dedup */
  investmentKey?: string;
  /** PROFIT rows only — drives session P&L and AUM */
  profitUsd?: number;
}

export const LIVE_ACTIVITY_TABS: {
  key: LiveActivityTab;
  label: string;
}[] = [
  { key: "all", label: "Command Stream" },
  { key: "trades", label: "Scalp Engine" },
  { key: "profits", label: "Yield Ledger" },
  { key: "investments", label: "Bot Investments" },
];

export const TRADE_KINDS: TradeLogKind[] = [
  "SCAN",
  "SIGNAL",
  "ANALYZE",
  "BUY",
  "SELL",
  "EXECUTED",
  "MONITOR",
];

export const PROFIT_KINDS: TradeLogKind[] = ["PROFIT"];
