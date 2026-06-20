"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { GoldButton } from "@/components/ui/gold-button";
import { V2PreviewSlidePanel } from "@/components/announcements/v2-preview-slide-panels";
import { V2_PREVIEW_SLIDES } from "@/lib/announcements/v2-preview-campaign";
import { cn } from "@/lib/utils";

interface V2PreviewAnnouncementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function V2PreviewAnnouncementModal({
  open,
  onOpenChange,
}: V2PreviewAnnouncementModalProps) {
  const [index, setIndex] = useState(0);
  const slide = V2_PREVIEW_SLIDES[index]!;
  const isLast = index === V2_PREVIEW_SLIDES.length - 1;
  const isFirst = index === 0;

  const goNext = useCallback(() => {
    if (isLast) {
      onOpenChange(false);
      setIndex(0);
      return;
    }
    setIndex((current) => Math.min(current + 1, V2_PREVIEW_SLIDES.length - 1));
  }, [isLast, onOpenChange]);

  const goPrev = useCallback(() => {
    setIndex((current) => Math.max(current - 1, 0));
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) setIndex(0);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90dvh] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border-amber-500/25 bg-zinc-950 p-0 text-white sm:max-w-sm"
      >
        <DialogTitle className="sr-only">{slide.title}</DialogTitle>

        <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Image
              src="/assets/logo-tradiq.png"
              alt="TradIQ"
              width={28}
              height={28}
              className="h-7 w-7 rounded-lg object-contain"
            />
            <span className="text-[11px] font-bold uppercase tracking-wide text-amber-400">
              Upcoming Updates Next week
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            aria-label="Close announcement"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-center gap-1.5 px-4 py-2.5">
          {V2_PREVIEW_SLIDES.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all cursor-pointer",
                i === index
                  ? "w-6 bg-amber-400"
                  : "w-1.5 bg-zinc-700 hover:bg-zinc-500"
              )}
            />
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          <V2PreviewSlidePanel slide={slide} />
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-white/5 px-4 py-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={isFirst}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {!isLast ? (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300 cursor-pointer"
            >
              Skip
            </button>
          ) : (
            <span className="flex-1" />
          )}

          <GoldButton
            type="button"
            className="min-w-[7.5rem] flex-1"
            onClick={goNext}
          >
            {isLast ? "Got it" : "Next"}
          </GoldButton>

          <button
            type="button"
            onClick={goNext}
            disabled={isLast}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
