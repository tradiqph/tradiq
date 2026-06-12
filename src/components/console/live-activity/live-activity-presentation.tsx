"use client";

import { useCallback, useEffect, useState } from "react";
import { LiveActivityHeader } from "@/components/console/live-activity/live-activity-header";
import { LiveActivityLogFeed } from "@/components/console/live-activity/live-activity-log-feed";
import { LiveActivityScanBar } from "@/components/console/live-activity/live-activity-scan-bar";
import { LiveActivitySidebar } from "@/components/console/live-activity/live-activity-sidebar";
import { LiveActivityTabs } from "@/components/console/live-activity/live-activity-tabs";
import type { LiveActivityTab } from "@/components/console/live-activity/live-activity-types";
import { useLiveActivityEngine } from "@/components/console/live-activity/use-live-activity-engine";
import { cn } from "@/lib/utils";

interface LiveActivityPresentationProps {
  open: boolean;
  onClose: () => void;
}

export function LiveActivityPresentation({
  open,
  onClose,
}: LiveActivityPresentationProps) {
  const [tab, setTab] = useState<LiveActivityTab>("all");
  const { filteredLogs, aumPhp, sessionPnlUsd, aumTickFlash } =
    useLiveActivityEngine(open, tab);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  const emptyLabel =
    tab === "investments"
      ? "No capital intake events yet…"
      : tab === "profits"
        ? "No closed wins in stream…"
        : "Awaiting command stream…";

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col bg-black",
        !open && "pointer-events-none invisible"
      )}
      role="dialog"
      aria-modal={open}
      aria-hidden={!open}
      aria-label="Live Activity presentation"
    >
      <LiveActivityHeader
        aumPhp={aumPhp}
        sessionPnlUsd={sessionPnlUsd}
        aumTickFlash={aumTickFlash}
        onClose={onClose}
      />
      <LiveActivityTabs active={tab} onChange={setTab} />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <LiveActivityLogFeed logs={filteredLogs} emptyLabel={emptyLabel} />
          <LiveActivityScanBar />
        </div>
        <LiveActivitySidebar />
      </div>
    </div>
  );
}
