"use client";

import { Crown, PartyPopper } from "lucide-react";
import { ConfettiBurst } from "@/components/rewards/confetti-burst";
import { GoldButton } from "@/components/ui/gold-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RankActivationSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badge: string;
  label: string;
  benefits: string[];
}

export function RankActivationSuccessDialog({
  open,
  onOpenChange,
  badge,
  label,
  benefits,
}: RankActivationSuccessDialogProps) {
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
              You unlocked a new rank badge. Your leadership benefits are now
              active.
            </p>

            <div className="mx-auto flex flex-col items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
                <Crown className="h-8 w-8 text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                  New rank unlocked
                </p>
                <p className="mt-1 text-2xl font-bold text-white">{badge}</p>
                <p className="mt-1 text-sm text-amber-400/90">{label}</p>
              </div>
            </div>

            {benefits.length > 0 ? (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-left">
                <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                  Your benefits
                </p>
                <ul className="mt-2 space-y-1.5">
                  {benefits.map((benefit) => (
                    <li key={benefit} className="text-sm text-zinc-300">
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <GoldButton className="w-full" onClick={() => onOpenChange(false)}>
              Done
            </GoldButton>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
