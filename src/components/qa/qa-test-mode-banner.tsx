"use client";

import { AlertTriangle, FlaskConical } from "lucide-react";

export function QaTestModeBanner() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <p>
        QA test mode — eligibility is simulated. This is not real production
        progress.
      </p>
    </div>
  );
}

export function QaTestModeBannerCompact() {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300/90">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>QA test mode active</span>
    </div>
  );
}
