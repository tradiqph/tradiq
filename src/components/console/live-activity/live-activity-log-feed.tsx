"use client";

import { useEffect, useRef } from "react";
import type { LiveActivityLogEntry } from "@/components/console/live-activity/live-activity-types";
import {
  formatLogTime,
  kindColor,
} from "@/components/console/live-activity/use-live-activity-engine";
import { cn } from "@/lib/utils";

interface LiveActivityLogFeedProps {
  logs: LiveActivityLogEntry[];
  emptyLabel?: string;
}

export function LiveActivityLogFeed({
  logs,
  emptyLabel = "Awaiting stream…",
}: LiveActivityLogFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <div
      ref={containerRef}
      className="live-activity-feed relative min-h-0 flex-1 overflow-y-auto bg-black/80 px-3 py-2 sm:px-4"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.08)_50%)] bg-[length:100%_4px] opacity-30" />
      <div className="live-activity-scanline pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

      {logs.length === 0 ? (
        <p className="py-8 text-center font-mono text-xs text-zinc-600">
          {emptyLabel}
        </p>
      ) : (
        <ul className="relative space-y-0.5">
          {logs.map((log) => (
            <li
              key={log.id}
              className={cn(
                "flex flex-wrap items-baseline gap-x-2 rounded px-1 py-0.5 font-mono text-[11px] leading-relaxed sm:text-xs",
                log.isNew && "live-activity-row-new border-l-2 border-amber-400/60 bg-amber-500/5"
              )}
            >
              <span className="shrink-0 text-zinc-600">
                [{formatLogTime(log.timestamp)}]
              </span>
              <span
                className={cn(
                  "shrink-0 font-bold tracking-wide",
                  kindColor(log.kind)
                )}
              >
                {log.kind}
              </span>
              <span className="min-w-0 break-all text-zinc-300">
                {log.message}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
