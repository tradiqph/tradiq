"use client";

import { Calendar, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeso } from "@/lib/finance";
import type { PaymongoDashboardData } from "@/lib/paymongo-dashboard";
import { cn } from "@/lib/utils";

interface PaymongoDashboardCardsProps {
  data: PaymongoDashboardData | null;
  loading: boolean;
  error: string | null;
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/80 p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-40" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

export function PaymongoDashboardCards({
  data,
  loading,
  error,
}: PaymongoDashboardCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!data?.configured) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-500">
        PayMongo wallet not configured — set{" "}
        <code className="text-zinc-400">PAYMONGO_SECRET_KEY</code> and{" "}
        <code className="text-zinc-400">PAYMONGO_WALLET_ACCOUNT_NUMBER</code>{" "}
        to show balance and payout cards.
      </div>
    );
  }

  const balanceError = error && data.totalBalance == null ? error : null;
  const payoutError =
    data.error && data.upcomingPayoutAmount == null ? data.error : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div
        className={cn(
          "rounded-xl border p-5",
          "border-emerald-500/30 bg-gradient-to-br from-emerald-950/80 to-emerald-900/20"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-emerald-100/90">Total Balance</p>
          <Wallet className="h-4 w-4 shrink-0 text-emerald-300/70" />
        </div>
        <p className="mt-2 text-3xl font-bold tabular-nums text-white">
          {data.totalBalance != null
            ? formatPeso(data.totalBalance)
            : balanceError
              ? "—"
              : formatPeso(0)}
        </p>
        {data.walletAccountLast4 && (
          <p className="mt-1 text-sm text-emerald-200/60">
            {data.walletAccountLast4}
          </p>
        )}
        {data.pendingBalance != null && data.pendingBalance > 0 && (
          <p className="mt-1 text-xs text-emerald-200/50">
            {formatPeso(data.pendingBalance)} pending
          </p>
        )}
        {balanceError && (
          <p className="mt-2 text-xs text-red-300/90">{balanceError}</p>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-900/80 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-zinc-300">Upcoming payout</p>
          <Calendar className="h-4 w-4 shrink-0 text-zinc-500" />
        </div>
        <p className="mt-2 text-3xl font-bold tabular-nums text-white">
          {data.upcomingPayoutAmount != null
            ? formatPeso(data.upcomingPayoutAmount)
            : payoutError
              ? "—"
              : "—"}
        </p>
        {data.upcomingPayoutReceiveBy ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            Receive by: {data.upcomingPayoutReceiveBy}
          </p>
        ) : payoutError ? (
          <p className="mt-2 text-xs text-red-300/90">{payoutError}</p>
        ) : (
          <p className="mt-2 text-xs text-zinc-600">No upcoming payout scheduled</p>
        )}
        <p className="mt-2 text-[10px] text-zinc-600">Via PayMongo Payments, Inc.</p>
      </div>
    </div>
  );
}
