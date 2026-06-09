"use client";

import { ArrowDownLeft, ArrowUpRight, Trophy, Headphones } from "lucide-react";
import { GoldButton } from "@/components/ui/gold-button";
import { ActionChip } from "@/components/ui/action-chip";

interface QuickActionsProps {
  onDeposit: () => void;
  onWithdraw: () => void;
}

export function QuickActions({ onDeposit, onWithdraw }: QuickActionsProps) {
  return (
    <div className="space-y-3 px-4 py-4">
      <div className="grid grid-cols-2 gap-3">
        <GoldButton onClick={onDeposit} className="w-full">
          <ArrowDownLeft className="mr-2 h-4 w-4" />
          Deposit
        </GoldButton>
        <GoldButton onClick={onWithdraw} className="w-full">
          <ArrowUpRight className="mr-2 h-4 w-4" />
          Withdraw
        </GoldButton>
      </div>
      <div className="flex flex-wrap gap-2">
        <ActionChip label="Leaderboard" href="/bot" icon={Trophy} />
        <ActionChip label="Support" href="#" icon={Headphones} />
      </div>
    </div>
  );
}
