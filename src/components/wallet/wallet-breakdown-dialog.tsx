"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PesoAmount } from "@/components/ui/peso-amount";
import { computeWalletBreakdown } from "@/lib/wallet-breakdown";
import { formatPeso } from "@/lib/finance";
import { UserProfile } from "@/types";
import { TrendingUp, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface WalletBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile;
}

function BreakdownBar({
  investmentPercent,
  referralPercent,
}: {
  investmentPercent: number;
  referralPercent: number;
}) {
  if (investmentPercent === 0 && referralPercent === 0) {
    return (
      <div className="h-2 w-full rounded-full bg-zinc-800" aria-hidden />
    );
  }

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-800">
      <div
        className="bg-amber-400 transition-all"
        style={{ width: `${investmentPercent}%` }}
      />
      <div
        className="bg-emerald-400 transition-all"
        style={{ width: `${referralPercent}%` }}
      />
    </div>
  );
}

function SourceRow({
  icon: Icon,
  label,
  amount,
  percent,
  colorClass,
}: {
  icon: typeof TrendingUp;
  label: string;
  amount: number;
  percent: number;
  colorClass: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            colorClass
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm text-white">{label}</p>
          <p className="text-xs text-zinc-500">{percent}% of earnings</p>
        </div>
      </div>
      <PesoAmount amount={amount} className="text-sm text-white" />
    </div>
  );
}

export function WalletBreakdownDialog({
  open,
  onOpenChange,
  profile,
}: WalletBreakdownDialogProps) {
  const breakdown = computeWalletBreakdown(profile);
  const hasEarnings = breakdown.totalEarnings > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-amber-500/20 bg-zinc-950 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Wallet className="h-4 w-4 text-amber-400" />
            Wallet breakdown
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="surface-flat p-4">
            <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
              Current balance
            </p>
            <PesoAmount
              amount={breakdown.walletBalance}
              gold
              className="text-3xl"
            />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
              Earnings sources
            </p>

            {hasEarnings ? (
              <>
                <BreakdownBar
                  investmentPercent={breakdown.investmentPercent}
                  referralPercent={breakdown.referralPercent}
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                    Investment {breakdown.investmentPercent}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                    Referral {breakdown.referralPercent}%
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  <SourceRow
                    icon={TrendingUp}
                    label="Bot investments"
                    amount={breakdown.investmentEarnings}
                    percent={breakdown.investmentPercent}
                    colorClass="bg-amber-500/15 text-amber-400"
                  />
                  <SourceRow
                    icon={Users}
                    label="Referrals"
                    amount={breakdown.referralEarnings}
                    percent={breakdown.referralPercent}
                    colorClass="bg-emerald-500/15 text-emerald-400"
                  />
                </div>

                <p className="text-xs text-zinc-500">
                  Total lifetime earnings:{" "}
                  <span className="text-zinc-300">
                    {formatPeso(breakdown.totalEarnings)}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                No earnings yet. Subscribe to a bot or invite referrals to start
                earning.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="surface-flat p-3">
              <p className="text-[10px] text-zinc-500 uppercase">Deposited</p>
              <p className="text-sm font-semibold text-white">
                {formatPeso(breakdown.totalDeposited)}
              </p>
            </div>
            <div className="surface-flat p-3">
              <p className="text-[10px] text-zinc-500 uppercase">Withdrawn</p>
              <p className="text-sm font-semibold text-white">
                {formatPeso(breakdown.totalWithdrawn)}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
