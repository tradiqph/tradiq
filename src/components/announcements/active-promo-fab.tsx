"use client";

import { Percent } from "lucide-react";
import { isActivePromoAvailable } from "@/lib/announcements/active-promo-campaign";
import { cn } from "@/lib/utils";

interface ActivePromoFabProps {
  onClick: () => void;
}

export function ActivePromoFab({ onClick }: ActivePromoFabProps) {
  if (!isActivePromoAvailable()) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open active deposit promo"
      className={cn(
        "fixed right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full",
        "border border-amber-500/40 bg-zinc-950/95 text-amber-400 shadow-lg shadow-amber-500/20",
        "backdrop-blur-md transition-transform hover:scale-105 active:scale-95 cursor-pointer",
        "bottom-44 motion-safe:animate-pulse"
      )}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full border border-amber-400/30 motion-safe:animate-ping" />
      <span className="relative flex flex-col items-center leading-none">
        <Percent className="h-4 w-4" />
        <span className="mt-0.5 text-[9px] font-bold">2%</span>
      </span>
    </button>
  );
}
