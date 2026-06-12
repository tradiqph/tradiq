"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { ConsoleBotInvestment } from "@/lib/console/investments-group";
import {
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
  PROFIT_KINDS,
  TRADE_KINDS,
} from "@/components/console/live-activity/live-activity-types";

const MAX_LOGS = 200;
const POLL_MS = 15_000;
const INITIAL_INVESTMENT_SEED = 10;

interface InvestmentsResponse {
  investments: ConsoleBotInvestment[];
}

function investmentKey(inv: ConsoleBotInvestment): string {
  return `${inv.userId}:${inv.id}`;
}

function investmentToLog(
  inv: ConsoleBotInvestment,
  botName: string
): LiveActivityLogEntry {
  const name = displayInvestorName(inv.displayName, inv.email);
  const usdt = phpToPresentationUsdt(inv.amount);
  const subscribed = inv.subscribedAt ? new Date(inv.subscribedAt) : new Date();

  return {
    id: `inv-${investmentKey(inv)}`,
    kind: "SUB",
    investmentKey: investmentKey(inv),
    timestamp: subscribed,
    isNew: true,
    message: ` › ${name} · ₱${inv.amount.toLocaleString("en-PH")} · ${usdt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT allocated · ${botName} · ACTIVE`,
  };
}

function filterLogs(
  logs: LiveActivityLogEntry[],
  tab: LiveActivityTab
): LiveActivityLogEntry[] {
  switch (tab) {
    case "investments":
      return logs.filter((l) => l.kind === "SUB");
    case "profits":
      return logs.filter((l) => PROFIT_KINDS.includes(l.kind));
    case "trades":
      return logs.filter((l) => TRADE_KINDS.includes(l.kind));
    default:
      return logs;
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

  const appendLogs = useCallback((entries: LiveActivityLogEntry[]) => {
    updateLiveActivitySession((prev) => {
      let aumPhp = prev.aumPhp;
      let sessionPnlUsd = prev.sessionPnlUsd;
      let aumTickFlash = false;

      for (const e of entries) {
        if (e.kind === "PROFIT" && e.profitUsd != null && e.profitUsd > 0) {
          sessionPnlUsd = Math.round((sessionPnlUsd + e.profitUsd) * 100) / 100;
          aumPhp = Math.round((aumPhp + usdProfitToPhp(e.profitUsd)) * 100) / 100;
          aumTickFlash = true;
        }
      }

      return {
        ...prev,
        logs: [...prev.logs, ...entries].slice(-MAX_LOGS),
        aumPhp,
        sessionPnlUsd,
        aumTickFlash,
      };
    });
  }, []);

  const nextBotName = useCallback(() => {
    let name = "";
    updateLiveActivitySession((prev) => {
      name =
        BOTS_CATALOG_SEED[prev.botNameIndex % BOTS_CATALOG_SEED.length]!.name;
      return { ...prev, botNameIndex: prev.botNameIndex + 1 };
    });
    return name;
  }, []);

  const processInvestments = useCallback(
    (investments: ConsoleBotInvestment[]) => {
      const prev = getLiveActivitySession();
      const sorted = [...investments].sort((a, b) => {
        const ta = a.subscribedAt ? new Date(a.subscribedAt).getTime() : 0;
        const tb = b.subscribedAt ? new Date(b.subscribedAt).getTime() : 0;
        return tb - ta;
      });

      const seen = new Set(prev.seenInvestmentKeys);
      const toEmit: ConsoleBotInvestment[] = [];

      if (!prev.investmentsInitialized) {
        const recent = sorted.slice(0, INITIAL_INVESTMENT_SEED);
        for (const inv of [...recent].reverse()) {
          const key = investmentKey(inv);
          if (!seen.has(key)) {
            seen.add(key);
            toEmit.push(inv);
          }
        }
      } else {
        for (const inv of sorted) {
          const key = investmentKey(inv);
          if (seen.has(key)) continue;
          seen.add(key);
          toEmit.push(inv);
        }
      }

      if (!prev.investmentsInitialized || toEmit.length > 0) {
        updateLiveActivitySession((s) => ({
          ...s,
          seenInvestmentKeys: seen,
          investmentsInitialized: true,
        }));
      }

      if (toEmit.length > 0) {
        const ordered = toEmit.sort((a, b) => {
          const ta = a.subscribedAt ? new Date(a.subscribedAt).getTime() : 0;
          const tb = b.subscribedAt ? new Date(b.subscribedAt).getTime() : 0;
          return ta - tb;
        });
        appendLogs(ordered.map((inv) => investmentToLog(inv, nextBotName())));
      }
    },
    [appendLogs, nextBotName]
  );

  const fetchInvestments = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/console/investments?status=all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = (await res.json()) as InvestmentsResponse;
      processInvestments(json.investments ?? []);
    } catch {
      /* presentation-only */
    }
  }, [user, processInvestments]);

  // Simulated trade stream — only while overlay open
  useEffect(() => {
    if (!open) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const rng = rngRef.current;

    const tick = () => {
      if (shouldBurst(rng)) {
        appendLogs(generateTradeBurst(rng));
      } else {
        appendLogs([generateTradeLog(rng)]);
      }
      timeoutId = setTimeout(tick, randomIntervalMs(rng));
    };

    timeoutId = setTimeout(tick, 800);
    return () => clearTimeout(timeoutId);
  }, [open, appendLogs]);

  // Investment poller — only while overlay open
  useEffect(() => {
    if (!open) return;

    fetchInvestments();
    const id = setInterval(fetchInvestments, POLL_MS);
    return () => clearInterval(id);
  }, [open, fetchInvestments]);

  // Clear isNew flash after animation
  useEffect(() => {
    const hasNew = session.logs.some((l) => l.isNew);
    if (!hasNew) return;
    const id = setTimeout(() => {
      updateLiveActivitySession((prev) => ({
        ...prev,
        logs: prev.logs.map((l) => ({ ...l, isNew: false })),
      }));
    }, 1200);
    return () => clearTimeout(id);
  }, [session.logs]);

  // Clear AUM tick flash
  useEffect(() => {
    if (!session.aumTickFlash) return;
    const id = setTimeout(() => {
      updateLiveActivitySession((prev) => ({ ...prev, aumTickFlash: false }));
    }, 600);
    return () => clearTimeout(id);
  }, [session.aumTickFlash]);

  const filteredLogs = filterLogs(session.logs, tab);

  return {
    filteredLogs,
    aumPhp: session.aumPhp,
    sessionPnlUsd: session.sessionPnlUsd,
    aumTickFlash: session.aumTickFlash,
    allLogsCount: session.logs.length,
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
    case "MONITOR":
      return "text-zinc-500";
    case "SUB":
      return "text-amber-300";
    default:
      return "text-zinc-300";
  }
}

export { formatLogTime };
