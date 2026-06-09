"use client";

import { useState } from "react";
import Image from "next/image";
import { Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { PesoAmount } from "@/components/ui/peso-amount";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { WalletBreakdownDialog } from "@/components/wallet/wallet-breakdown-dialog";
import { UserProfile } from "@/types";

interface WalletCarouselProps {
  profile: UserProfile;
}

export function WalletCarousel({ profile }: WalletCarouselProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  return (
    <>
      <div className="px-4 pb-2">
        <div className="bento-grid">
          <div className="surface-accent relative col-span-2 overflow-hidden p-5">
            <Image
              src="/assets/wallet-card-bg.png"
              alt=""
              fill
              className="object-cover opacity-20"
            />
            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Wallet className="h-4 w-4 text-amber-400" />
                  WALLET BALANCE
                </div>
                <button
                  type="button"
                  onClick={() => setBreakdownOpen(true)}
                  className="cursor-pointer rounded-full focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:outline-none"
                  aria-label="View wallet earnings breakdown"
                >
                  <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 transition-colors hover:bg-emerald-500/20">
                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    EARNINGS
                  </Badge>
                </button>
              </div>
              <PesoAmount
                amount={profile.walletBalance}
                className="text-4xl text-white"
              />
            </div>
          </div>

          <StatTile
            label="Deposited"
            value={profile.totalDeposited}
            icon={ArrowDownLeft}
            peso
          />
          <StatTile
            label="Withdrawn"
            value={profile.totalWithdrawn}
            icon={ArrowUpRight}
            peso
          />
        </div>
      </div>

      <WalletBreakdownDialog
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        profile={profile}
      />
    </>
  );
}
