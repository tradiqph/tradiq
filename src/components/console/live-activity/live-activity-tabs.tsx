"use client";

import type { LiveActivityTab } from "@/components/console/live-activity/live-activity-types";
import { LIVE_ACTIVITY_TABS } from "@/components/console/live-activity/live-activity-types";
import { cn } from "@/lib/utils";

interface LiveActivityTabsProps {
  active: LiveActivityTab;
  onChange: (tab: LiveActivityTab) => void;
}

export function LiveActivityTabs({ active, onChange }: LiveActivityTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-white/5 px-4 py-3 sm:px-6">
      {LIVE_ACTIVITY_TABS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "rounded-full px-3 py-1.5 font-mono text-[10px] font-medium transition-colors cursor-pointer sm:text-xs",
            active === key
              ? "bg-violet-500/25 text-violet-200 ring-1 ring-violet-500/40"
              : "bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
