"use client";

import { useEffect, useState } from "react";
import {
  formatV2PreviewCountdown,
  formatV2PreviewDeadlineLabel,
  getV2PreviewTimeRemaining,
} from "@/lib/announcements/v2-preview-campaign";
import { cn } from "@/lib/utils";

function CountdownUnit({
  label,
  value,
  compact,
}: {
  label: string;
  value: number;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-amber-500/30 bg-black/60 shadow-[0_0_20px_rgba(245,158,11,0.12)]",
        compact ? "min-w-[2.75rem] px-2 py-1.5" : "min-w-[3.25rem] px-2.5 py-2"
      )}
    >
      <span
        className={cn(
          "font-bold tabular-nums text-amber-300",
          compact ? "text-base" : "text-xl"
        )}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[8px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
    </div>
  );
}

export function V2PreviewCountdown({ compact }: { compact?: boolean }) {
  const [remaining, setRemaining] = useState<number | null>(() =>
    getV2PreviewTimeRemaining()
  );

  useEffect(() => {
    const tick = () => setRemaining(getV2PreviewTimeRemaining());
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (remaining == null) return null;

  const { days, hours, minutes, seconds } = formatV2PreviewCountdown(remaining);

  return (
    <div className="space-y-2">
      <div className="flex justify-center gap-1.5">
        <CountdownUnit label="Days" value={days} compact={compact} />
        <CountdownUnit label="Hrs" value={hours} compact={compact} />
        <CountdownUnit label="Min" value={minutes} compact={compact} />
        <CountdownUnit label="Sec" value={seconds} compact={compact} />
      </div>
      {!compact && (
        <p className="text-center text-[10px] text-zinc-500">
          Ends {formatV2PreviewDeadlineLabel()} (PH time)
        </p>
      )}
    </div>
  );
}

export function V2PreviewRateBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/20 to-amber-400/10 px-4 py-1.5 text-sm font-bold shadow-[0_0_24px_rgba(245,158,11,0.15)]",
        className
      )}
    >
      <span className="text-zinc-500 line-through decoration-zinc-600">15%</span>
      <span className="text-amber-500/70">→</span>
      <span className="text-amber-200">7%</span>
    </div>
  );
}
