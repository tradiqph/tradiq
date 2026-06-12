"use client";

import { Activity, X } from "lucide-react";
import { formatPresentationPeso } from "@/lib/console/live-activity-format";
import { cn } from "@/lib/utils";

interface LiveActivityHeaderProps {
  aumPhp: number;
  sessionPnlUsd: number;
  aumTickFlash: boolean;
  onClose: () => void;
}

export function LiveActivityHeader({
  aumPhp,
  sessionPnlUsd,
  aumTickFlash,
  onClose,
}: LiveActivityHeaderProps) {
  return (
    <div className="border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-400" />
            <p className="text-[10px] font-semibold tracking-[0.2em] text-amber-400/80">
              TRADIQ BOT TERMINAL
            </p>
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
              LIVE
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
            ● RPC CONNECTED · CHAIN 56 · 142ms
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-900 text-zinc-400 hover:border-amber-500/30 hover:text-white cursor-pointer"
          aria-label="Close live activity"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className={cn(
            "rounded-xl border border-white/5 bg-black/60 p-3 transition-colors duration-300",
            aumTickFlash && "live-activity-aum-tick border-emerald-500/30"
          )}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
            Assets Under Management
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-white sm:text-xl">
            {formatPresentationPeso(aumPhp)}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">updates with session profits</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
            Session P&amp;L
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-emerald-400 sm:text-xl">
            +$
            {sessionPnlUsd.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-600/80">this session</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/60 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
            Win Rate
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-white sm:text-xl">
            92.4%
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/60 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
            Trades Executed
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-white sm:text-xl">
            14,218
          </p>
        </div>
      </div>
    </div>
  );
}
