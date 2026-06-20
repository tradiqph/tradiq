"use client";

import Image from "next/image";
import { Copy, Percent, X, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ACTIVE_PROMO,
  ACTIVE_PROMO_IMAGE,
} from "@/lib/announcements/active-promo-campaign";
import { toast } from "sonner";

interface ActivePromoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActivePromoModal({ open, onOpenChange }: ActivePromoModalProps) {
  const copyAccountNumber = async () => {
    try {
      await navigator.clipboard.writeText(ACTIVE_PROMO.paymongoAccountNumber);
      toast.success("Account number copied");
    } catch {
      toast.error("Could not copy account number");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90dvh] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border-amber-500/25 bg-zinc-950 p-0 text-white sm:max-w-sm"
      >
        <DialogTitle className="sr-only">{ACTIVE_PROMO.title}</DialogTitle>

        <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <Percent className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Active Promo
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close promo"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-4">
          <div className="relative mx-auto aspect-[9/16] w-full max-h-[min(62dvh,520px)] overflow-hidden rounded-2xl border border-amber-500/25 bg-black shadow-[0_0_32px_rgba(245,158,11,0.1)]">
            <Image
              src={ACTIVE_PROMO_IMAGE}
              alt={ACTIVE_PROMO.title}
              fill
              className="object-contain object-center"
              sizes="(max-width: 448px) 100vw, 448px"
              unoptimized
            />
          </div>

          <div className="mt-3 space-y-2 rounded-2xl border border-amber-500/20 bg-white/[0.04] p-3 backdrop-blur-sm">
            <p className="text-center text-base font-bold text-white">
              {ACTIVE_PROMO.minAmountLabel} direct deposit
            </p>
            <p className="text-center text-xs text-amber-300">
              Earn an extra{" "}
              <span className="font-bold">2% bonus</span> on qualifying deposits
            </p>

            <div className="rounded-xl border border-white/5 bg-black/40 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                PayMongo account
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {ACTIVE_PROMO.paymongoAccountName}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="font-mono text-sm text-amber-200">
                  {ACTIVE_PROMO.paymongoAccountNumber}
                </p>
                <button
                  type="button"
                  onClick={copyAccountNumber}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 text-amber-400 transition-colors hover:bg-amber-500/10 cursor-pointer"
                  aria-label="Copy account number"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <ul className="space-y-1.5 pt-1">
              {ACTIVE_PROMO.perks.map((perk) => (
                <li
                  key={perk}
                  className="flex items-center gap-2 text-xs text-zinc-300"
                >
                  <Zap className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
