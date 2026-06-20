"use client";

import Image from "next/image";
import { useV2PreviewAnnouncementOptional } from "@/hooks/use-v2-preview-announcement";
import { cn } from "@/lib/utils";

export function V2PreviewAnnouncementFab() {
  const ctx = useV2PreviewAnnouncementOptional();

  if (!ctx?.isCampaignActive) return null;

  return (
    <button
      type="button"
      onClick={ctx.openAnnouncement}
      aria-label="Open upcoming updates announcement"
      className={cn(
        "fixed right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full",
        "border border-amber-500/40 bg-zinc-950/95 shadow-lg shadow-amber-500/20",
        "backdrop-blur-md transition-transform hover:scale-105 active:scale-95 cursor-pointer",
        "bottom-28 motion-safe:animate-pulse"
      )}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full border border-amber-400/30 motion-safe:animate-ping" />
      <Image
        src="/assets/icon-512.png"
        alt=""
        width={28}
        height={28}
        className="relative h-7 w-7 rounded-full object-cover"
      />
    </button>
  );
}
