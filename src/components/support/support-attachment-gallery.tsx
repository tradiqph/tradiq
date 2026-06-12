"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SupportAttachmentGalleryProps {
  urls: string[];
  thumbnailClassName?: string;
}

export function SupportAttachmentGallery({
  urls,
  thumbnailClassName = "h-20 w-20",
}: SupportAttachmentGalleryProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (urls.length === 0) return null;

  const currentUrl = viewerIndex !== null ? urls[viewerIndex] : null;
  const hasMultiple = urls.length > 1;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, index) => (
          <button
            key={url}
            type="button"
            onClick={() => setViewerIndex(index)}
            className={cn(
              "relative shrink-0 overflow-hidden rounded-lg border border-white/10 transition-colors hover:border-amber-500/40 cursor-pointer",
              thumbnailClassName
            )}
            aria-label={`View attachment ${index + 1} of ${urls.length}`}
          >
            <Image
              src={url}
              alt={`Attachment ${index + 1}`}
              fill
              className="object-cover"
              unoptimized
            />
          </button>
        ))}
      </div>

      <Dialog
        open={viewerIndex !== null}
        onOpenChange={(open) => {
          if (!open) setViewerIndex(null);
        }}
      >
        <DialogContent
          showCloseButton
          className="max-h-[96dvh] max-w-[min(96vw,960px)] border-white/10 bg-black/95 p-3 sm:p-4"
        >
          <DialogTitle className="sr-only">Attachment preview</DialogTitle>

          {currentUrl && (
            <div className="flex flex-col gap-3">
              <div className="relative mx-auto h-[min(70dvh,720px)] w-full">
                <Image
                  src={currentUrl}
                  alt={`Attachment ${(viewerIndex ?? 0) + 1}`}
                  fill
                  className="object-contain"
                  unoptimized
                  sizes="(max-width: 960px) 96vw, 960px"
                />
              </div>

              {hasMultiple && (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setViewerIndex((i) =>
                        i === null ? 0 : (i - 1 + urls.length) % urls.length
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                    aria-label="Previous attachment"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <p className="text-xs text-zinc-500">
                    {(viewerIndex ?? 0) + 1} / {urls.length}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setViewerIndex((i) =>
                        i === null ? 0 : (i + 1) % urls.length
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                    aria-label="Next attachment"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
