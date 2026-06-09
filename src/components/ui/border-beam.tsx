"use client";

import { cn } from "@/lib/utils";

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
}

export function BorderBeam({
  className,
  size = 200,
  duration = 8,
}: BorderBeamProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute -inset-px z-0 overflow-hidden rounded-2xl",
        className
      )}
    >
      <div
        className="absolute inset-0 animate-[spin_var(--duration)_linear_infinite] opacity-50"
        style={
          {
            "--duration": `${duration}s`,
            background: `conic-gradient(from 0deg, transparent 0deg, transparent 260deg, rgba(245,158,11,0.45) 300deg, rgba(251,191,36,0.6) 360deg)`,
          } as React.CSSProperties
        }
      />
      <div
        className="absolute rounded-[15px] bg-black/95"
        style={{ inset: `${Math.max(1, size / 50)}px` }}
      />
    </div>
  );
}
