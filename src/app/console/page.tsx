"use client";

import Link from "next/link";
import { ConsoleError } from "@/components/console/console-error";
import { StatCard } from "@/components/console/stat-card";
import { PesoAmount } from "@/components/ui/peso-amount";
import { useConsoleFetch } from "@/hooks/use-console-fetch";
import { formatPeso } from "@/lib/finance";
import { ArrowRight, Wallet, TrendingUp } from "lucide-react";

interface ConsoleStats {
  totalMembers: number;
  pendingWithdrawals: number;
  pendingWithdrawalAmount: number;
  activeInvestments: number;
  activePrincipal: number;
  todayPayoutLiability: number;
  dueTodayCount: number;
  completingTodayCount: number;
  totalWallet: number;
  totalDeposit: number;
  totalDeposited: number;
  totalWithdrawn: number;
}

export default function ConsoleDashboardPage() {
  const { data, loading, error } = useConsoleFetch<ConsoleStats>(
    "/api/console/stats"
  );

  if (loading) {
    return <p className="text-zinc-500">Loading dashboard...</p>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-zinc-500">Platform overview</p>
        </div>
        <ConsoleError message={error ?? "Failed to load stats"} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-zinc-500">Platform overview</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total members" value={String(data.totalMembers)} />
        <StatCard
          label="Pending withdrawals"
          value={String(data.pendingWithdrawals)}
          sub={formatPeso(data.pendingWithdrawalAmount)}
        />
        <StatCard
          label="Active investments"
          value={String(data.activeInvestments)}
          sub={formatPeso(data.activePrincipal)}
        />
        <StatCard
          label="Today's payout liability"
          value={formatPeso(data.todayPayoutLiability)}
          sub={`${data.dueTodayCount} due today`}
        />
        <StatCard
          label="Total wallet balance"
          value={formatPeso(data.totalWallet)}
        />
        <StatCard
          label="Total deposit balance"
          value={formatPeso(data.totalDeposit)}
        />
        <StatCard
          label="Total deposited"
          value={formatPeso(data.totalDeposited)}
        />
        <StatCard
          label="Total withdrawn"
          value={formatPeso(data.totalWithdrawn)}
        />
        {data.completingTodayCount > 0 && (
          <StatCard
            label="Completing today"
            value={String(data.completingTodayCount)}
            sub="Investments reaching day 30"
          />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/console/withdrawals"
          className="surface-flat flex items-center justify-between p-4 transition-colors hover:bg-white/[0.03]"
        >
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-amber-400" />
            <div>
              <p className="font-medium text-white">Pending withdrawals</p>
              <p className="text-sm text-zinc-500">
                {data.pendingWithdrawals} requests ·{" "}
                <PesoAmount amount={data.pendingWithdrawalAmount} gold />
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-zinc-600" />
        </Link>
        <Link
          href="/console/investments?dueToday=true"
          className="surface-flat flex items-center justify-between p-4 transition-colors hover:bg-white/[0.03]"
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-amber-400" />
            <div>
              <p className="font-medium text-white">Due today</p>
              <p className="text-sm text-zinc-500">
                {data.dueTodayCount} investments ·{" "}
                <PesoAmount amount={data.todayPayoutLiability} gold />
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-zinc-600" />
        </Link>
      </div>
    </div>
  );
}
