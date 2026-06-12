"use client";

import Image from "next/image";
import { Download, ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GoldButton } from "@/components/ui/gold-button";
import {
  MARKETING_MATERIALS,
  downloadAllMarketingMaterials,
  downloadMarketingMaterial,
} from "@/lib/marketing-materials";
import { toast } from "sonner";

interface MarketingMaterialsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarketingMaterialsSheet({
  open,
  onOpenChange,
}: MarketingMaterialsSheetProps) {
  const handleDownload = async (id: string) => {
    const material = MARKETING_MATERIALS.find((m) => m.id === id);
    if (!material) return;
    try {
      await downloadMarketingMaterial(material);
      toast.success(`${material.title} downloaded`);
    } catch {
      toast.error("Download failed. Try again.");
    }
  };

  const handleDownloadAll = async () => {
    try {
      await downloadAllMarketingMaterials();
      toast.success("All marketing materials downloaded");
    } catch {
      toast.error("Download failed. Try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-amber-500/20 bg-zinc-950 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-amber-400" />
            Marketing Materials
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-zinc-400">
          Download ready-made images for social media, referrals, and promotions.
          Share TradIQ with your network.
        </p>

        <div className="space-y-4">
          {MARKETING_MATERIALS.map((material) => (
            <div
              key={material.id}
              className="overflow-hidden rounded-xl border border-white/10 bg-black/40"
            >
              <div className="relative aspect-square w-full">
                <Image
                  src={material.href}
                  alt={material.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              </div>
              <div className="space-y-2 p-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    {material.title}
                  </p>
                  <p className="text-xs text-zinc-500">{material.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownload(material.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 py-2 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>

        <GoldButton onClick={() => void handleDownloadAll()} className="w-full">
          <Download className="mr-2 h-4 w-4" />
          Download All (3 images)
        </GoldButton>
      </DialogContent>
    </Dialog>
  );
}
