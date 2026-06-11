"use client";

import { cn } from "@/lib/utils";

interface BorderBeamProps {
  className?: string;
}

export function BorderBeam({ className }: BorderBeamProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute -inset-px z-0 rounded-2xl border border-amber-500/25 shadow-[inset_0_0_24px_rgba(245,158,11,0.08)]",
        className
      )}
      aria-hidden
    />
  );
}
