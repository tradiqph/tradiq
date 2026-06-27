import { formatPeso } from "@/lib/finance";
import type { MetricProgress } from "@/lib/ranks/progress";
import { cn } from "@/lib/utils";

interface RankProgressBarProps {
  progress: MetricProgress;
  className?: string;
}

function formatMetricValue(progress: MetricProgress): string {
  if (progress.label === "Qualified Direct Referrals") {
    return `${progress.current} / ${progress.target}`;
  }

  return `${formatPeso(progress.current)} / ${formatPeso(progress.target)}`;
}

export function RankProgressBar({ progress, className }: RankProgressBarProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-zinc-400">{progress.label}</span>
        <span className="text-zinc-300">{formatMetricValue(progress)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <p className="text-right text-[10px] text-zinc-500">{progress.percent}%</p>
    </div>
  );
}
