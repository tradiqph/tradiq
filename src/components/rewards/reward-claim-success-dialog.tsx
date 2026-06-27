"use client";

import Image from "next/image";
import { PartyPopper } from "lucide-react";
import { ConfettiBurst } from "@/components/rewards/confetti-burst";
import { GoldButton } from "@/components/ui/gold-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RewardTierProgress } from "@/lib/rewards/config";

interface RewardClaimSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: RewardTierProgress | null;
  referenceNumber: string;
}

export function RewardClaimSuccessDialog({
  open,
  onOpenChange,
  tier,
  referenceNumber,
}: RewardClaimSuccessDialogProps) {
  if (!tier) return null;

  return (
    <>
      <ConfettiBurst active={open} />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-amber-500/20 bg-zinc-950 sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15">
              <PartyPopper className="h-7 w-7 text-amber-400" />
            </div>
            <DialogTitle className="text-2xl font-bold text-white">
              Congratulations!
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-center">
            <p className="text-sm text-zinc-400">
              Your reward claim has been submitted. Our team will process your
              delivery soon.
            </p>

            <div className="mx-auto flex flex-col items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="relative h-28 w-28 overflow-hidden rounded-xl border border-white/10 bg-zinc-800/90">
                <Image
                  src={tier.imageSrc}
                  alt={tier.imageAlt}
                  fill
                  className="object-contain p-2 brightness-110"
                  sizes="112px"
                />
              </div>
              <div>
                <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                  {tier.label}
                </p>
                <p className="mt-1 text-base font-semibold text-white">
                  {tier.name}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
              <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                Claim reference
              </p>
              <p className="mt-1 font-mono text-sm text-amber-400">
                {referenceNumber}
              </p>
            </div>

            <p className="text-xs text-zinc-500">
              Save this reference number. You can track your claim status in the
              Rewards Center.
            </p>

            <GoldButton className="w-full" onClick={() => onOpenChange(false)}>
              Done
            </GoldButton>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
