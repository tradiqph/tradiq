"use client";

import { useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { WalletCarousel } from "@/components/wallet/wallet-carousel";
import { QuickActions } from "@/components/wallet/quick-actions";
import { RecentTransactions } from "@/components/wallet/recent-transactions";
import { DepositModal } from "@/components/modals/deposit-modal";
import { WithdrawModal } from "@/components/modals/withdraw-modal";
import { useAuth } from "@/hooks/use-auth";
import { usePendingDepositSync } from "@/hooks/use-pending-deposit-sync";
import { useTransactions } from "@/hooks/use-transactions";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { transactions, loading } = useTransactions(user?.uid, 5);
  const hasPendingDeposits = transactions.some(
    (tx) => tx.type === "deposit" && tx.status === "pending"
  );
  usePendingDepositSync(hasPendingDeposits);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  if (!profile) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-full bg-zinc-800" />
        <Skeleton className="h-56 w-full bg-zinc-800" />
      </div>
    );
  }

  return (
    <>
      <AppHeader />
      <QuickActions
        onDeposit={() => setDepositOpen(true)}
        onWithdraw={() => setWithdrawOpen(true)}
      />
      <WalletCarousel profile={profile} />
      {!loading && <RecentTransactions transactions={transactions} />}
      <DepositModal open={depositOpen} onOpenChange={setDepositOpen} />
      <WithdrawModal
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        onOpenDeposit={() => {
          setWithdrawOpen(false);
          setDepositOpen(true);
        }}
      />
    </>
  );
}
