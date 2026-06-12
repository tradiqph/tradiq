"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { ConsoleBotInvestment } from "@/lib/console/investments-group";
import {
  computePresentationWinRate,
  displayInvestorName,
  formatLogTime,
  phpToPresentationUsdt,
  usdProfitToPhp,
} from "@/lib/console/live-activity-format";
import {
  getLiveActivitySession,
  subscribeLiveActivitySession,
  updateLiveActivitySession,
} from "@/lib/console/live-activity-session";
import {
  createSimulatorRng,
  generateTradeBurst,
  generateTradeLog,
  randomIntervalMs,
  shouldBurst,
} from "@/lib/console/live-activity-simulator";
import { BOTS_CATALOG_SEED } from "@/lib/bots-catalog";
import type {
  LiveActivityLogEntry,
  LiveActivityTab,
} from "@/components/console/live-activity/live-activity-types";
import {
  PNL_KINDS,
  TRADE_KINDS,
} from "@/components/console/live-activity/live-activity-types";

const MAX_TRADE_LOGS = 200;
const POLL_MS = 15_000;

interface InvestmentsResponse {
  investments: ConsoleBotInvestment[];
}

function investmentKey(inv: ConsoleBotInvestment): string {
  return `${inv.userId}:${inv.id}`;
}

function botNameAtIndex(index: number): string {
  return BOTS_CATALOG_SEED[index % BOTS_CATALOG_SEED.length]!.name;
}

function investmentToLog(
  inv: ConsoleBotInvestment,
  botName: string,
  isNew = true
): LiveActivityLogEntry {
  const name = displayInvestorName(inv.displayName, inv.email);
  const usdt = phpToPresentationUsdt(inv.amount);
  const subscribed = inv.subscribedAt ? new Date(inv.subscribedAt) : new Date();

  return {
    id: `inv-${investmentKey(inv)}`,
    kind: "SUB",
    investmentKey: investmentKey(inv),
    timestamp: subscribed,
    isNew,
    message: ` › ${name} · ₱${inv.amount.toLocaleString("en-PH")} · ${usdt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT allocated · ${botName} · ACTIVE`,
  };
}

function filterLogs(
  tradeLogs: LiveActivityLogEntry[],
  investmentLogs: LiveActivityLogEntry[],
  tab: LiveActivityTab
): LiveActivityLogEntry[] {
  switch (tab) {
    case "investments":
      return investmentLogs;
    case "profits":
      return tradeLogs.filter((l) => PNL_KINDS.includes(l.kind));
    case "trades":
      return tradeLogs.filter((l) => TRADE_KINDS.includes(l.kind));
    default:
      return tradeLogs;
  }
}

export function useLiveActivityEngine(open: boolean, tab: LiveActivityTab) {
  const { user } = useAuth();
  const session = useSyncExternalStore(
    subscribeLiveActivitySession,
    getLiveActivitySession,
    getLiveActivitySession
  );
  const rngRef = useRef(createSimulatorRng(session.rngSeed));

  useEffect(() => {
    rngRef.current = createSimulatorRng(session.rngSeed);
  }, [session.rngSeed]);

  const appendTradeLogs = useCallback((entries: LiveActivityLogEntry[]) => {
    updateLiveActivitySession((prev) => {
      let aumPhp = prev.aumPhp;
      let sessionPnlUsd = prev.sessionPnlUsd;
      let tradesExecuted = prev.tradesExecuted;
      let winningTrades = prev.winningTrades;
      let aumTickFlash = false;

      for (const e of entries) {
        const isClosed =
          (e.kind === "PROFIT" || e.kind === "LOSS") &&
          e.profitUsd != null &&
          e.profitUsd !== 0;
        if (!isClosed) continue;

        sessionPnlUsd =
          Math.round((sessionPnlUsd + e.profitUsd!) * 100) / 100;
        aumPhp =
          Math.round((aumPhp + usdProfitToPhp(e.profitUsd!)) * 100) / 100;
        aumTickFlash = true;
        tradesExecuted += 1;
        if (e.kind === "PROFIT" && e.profitUsd! > 0) {
          winningTrades += 1;
        }
      }

      return {
        ...prev,
        tradeLogs: [...prev.tradeLogs, ...entries].slice(-MAX_TRADE_LOGS),
        aumPhp,
        sessionPnlUsd,
        tradesExecuted,
        winningTrades,
        aumTickFlash,
      };
    });
  }, []);

  const processInvestments = useCallback(
    (investments: ConsoleBotInvestment[]) => {
      const prev = getLiveActivitySession();

      if (!prev.investmentsInitialized) {
        const ascending = [...investments].sort((a, b) => {
          const ta = a.subscribedAt ? new Date(a.subscribedAt).getTime() : 0;
          const tb = b.subscribedAt ? new Date(b.subscribedAt).getTime() : 0;
          return ta - tb;
        });

        const seen = new Set<string>();
        const snapshot = ascending.map((inv, i) => {
          seen.add(investmentKey(inv));
          return investmentToLog(inv, botNameAtIndex(i), false);
        });

        updateLiveActivitySession((s) => ({
          ...s,
          investmentLogs: snapshot,
          seenInvestmentKeys: seen,
          investmentsInitialized: true,
          botNameIndex: ascending.length,
        }));
        return;
      }

      const seen = new Set(prev.seenInvestmentKeys);
      const newInvestments: ConsoleBotInvestment[] = [];

      for (const inv of investments) {
        const key = investmentKey(inv);
        if (seen.has(key)) continue;
        seen.add(key);
        newInvestments.push(inv);
      }

      if (newInvestments.length === 0) return;

      newInvestments.sort((a, b) => {
        const ta = a.subscribedAt ? new Date(a.subscribedAt).getTime() : 0;
        const tb = b.subscribedAt ? new Date(b.subscribedAt).getTime() : 0;
        return ta - tb;
      });

      updateLiveActivitySession((s) => {
        let botNameIndex = s.botNameIndex;
        const newLogs = newInvestments.map((inv) => {
          const log = investmentToLog(inv, botNameAtIndex(botNameIndex), true);
          botNameIndex += 1;
          return log;
        });
        return {
          ...s,
          investmentLogs: [...s.investmentLogs, ...newLogs],
          seenInvestmentKeys: seen,
          botNameIndex,
        };
      });
    },
    []
  );

  const fetchInvestments = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/console/live-activity/investments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = (await res.json()) as InvestmentsResponse;
      processInvestments(json.investments ?? []);
    } catch {
      /* presentation-only */
    }
  }, [user, processInvestments]);

  useEffect(() => {
    if (!open) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const rng = rngRef.current;

    const tick = () => {
      if (shouldBurst(rng)) {
        appendTradeLogs(generateTradeBurst(rng));
      } else {
        appendTradeLogs([generateTradeLog(rng)]);
      }
      timeoutId = setTimeout(tick, randomIntervalMs(rng));
    };

    timeoutId = setTimeout(tick, 800);
    return () => clearTimeout(timeoutId);
  }, [open, appendTradeLogs]);

  useEffect(() => {
    if (!open) return;

    fetchInvestments();
    const id = setInterval(fetchInvestments, POLL_MS);
    return () => clearInterval(id);
  }, [open, fetchInvestments]);

  useEffect(() => {
    const hasNew =
      session.tradeLogs.some((l) => l.isNew) ||
      session.investmentLogs.some((l) => l.isNew);
    if (!hasNew) return;
    const id = setTimeout(() => {
      updateLiveActivitySession((prev) => ({
        ...prev,
        tradeLogs: prev.tradeLogs.map((l) => ({ ...l, isNew: false })),
        investmentLogs: prev.investmentLogs.map((l) => ({ ...l, isNew: false })),
      }));
    }, 1200);
    return () => clearTimeout(id);
  }, [session.tradeLogs, session.investmentLogs]);

  useEffect(() => {
    if (!session.aumTickFlash) return;
    const id = setTimeout(() => {
      updateLiveActivitySession((prev) => ({ ...prev, aumTickFlash: false }));
    }, 600);
    return () => clearTimeout(id);
  }, [session.aumTickFlash]);

  const filteredLogs = filterLogs(
    session.tradeLogs,
    session.investmentLogs,
    tab
  );

  const winRatePct = computePresentationWinRate(
    session.winningTrades,
    session.tradesExecuted
  );

  return {
    filteredLogs,
    aumPhp: session.aumPhp,
    sessionPnlUsd: session.sessionPnlUsd,
    tradesExecuted: session.tradesExecuted,
    winRatePct,
    aumTickFlash: session.aumTickFlash,
  };
}

export function kindColor(kind: LiveActivityLogEntry["kind"]): string {
  switch (kind) {
    case "SCAN":
      return "text-cyan-400";
    case "SIGNAL":
      return "text-amber-400";
    case "ANALYZE":
      return "text-violet-400";
    case "BUY":
      return "text-emerald-400";
    case "SELL":
      return "text-red-400";
    case "EXECUTED":
      return "text-zinc-400";
    case "PROFIT":
      return "text-emerald-300";
    case "LOSS":
      return "text-red-400";
    case "MONITOR":
      return "text-zinc-500";
    case "SUB":
      return "text-amber-300";
    default:
      return "text-zinc-300";
  }
}

export { formatLogTime };
