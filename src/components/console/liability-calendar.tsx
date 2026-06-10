"use client";

import { ConsoleError } from "@/components/console/console-error";
import { StatCard } from "@/components/console/stat-card";
import { PesoAmount } from "@/components/ui/peso-amount";
import { useConsoleFetch } from "@/hooks/use-console-fetch";
import { formatPeso } from "@/lib/finance";
import { cn } from "@/lib/utils";

interface LiabilityCalendarDay {
  dateKey: string;
  label: string;
  interest: number;
  principal: number;
  grossLiability: number;
  approvedWithdrawals: number;
  netExpectedCashout: number;
  isToday: boolean;
}

interface LiabilityCalendarResponse {
  days: LiabilityCalendarDay[];
  totals: {
    grossLiability: number;
    approvedWithdrawals: number;
    netExpectedCashout: number;
  };
  commissionsSummary: {
    totalCommissionsPaid: number;
    totalAdminCommission: number;
  };
}

function weekLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function LiabilityCalendar() {
  const { data, loading, error } = useConsoleFetch<LiabilityCalendarResponse>(
    "/api/console/liability-calendar"
  );

  if (loading) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Estimated Daily Liability
          </h2>
          <p className="text-sm text-zinc-500">Loading calendar...</p>
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Estimated Daily Liability
          </h2>
          <p className="text-sm text-zinc-500">
            Expected bot payouts minus approved withdrawals (60 days, Philippine
            time)
          </p>
        </div>
        <ConsoleError message={error ?? "Failed to load liability calendar"} />
      </section>
    );
  }

  let currentWeek = "";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Estimated Daily Liability
        </h2>
        <p className="text-sm text-zinc-500">
          Expected bot payouts minus approved withdrawals (60 days, Philippine
          time)
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total commissions paid"
          value={formatPeso(data.commissionsSummary.totalCommissionsPaid)}
          sub="Paid to uplines only"
        />
        <StatCard
          label="60-day gross liability"
          value={formatPeso(data.totals.grossLiability)}
          sub="Interest + principal scheduled"
        />
        <StatCard
          label="60-day approved withdrawals"
          value={formatPeso(data.totals.approvedWithdrawals)}
          sub="Deducted by approval date"
        />
        <StatCard
          label="60-day net expected cashout"
          value={formatPeso(data.totals.netExpectedCashout)}
          sub="Gross liability − approved withdrawals"
        />
      </div>

      <div className="surface-flat max-h-[480px] overflow-y-auto">
        <div className="divide-y divide-white/[0.06]">
          {data.days.map((day) => {
            const week = weekLabel(day.dateKey);
            const showWeekHeader = week !== currentWeek;
            if (showWeekHeader) currentWeek = week;

            const hasActivity =
              day.grossLiability > 0 || day.approvedWithdrawals > 0;

            return (
              <div key={day.dateKey}>
                {showWeekHeader && (
                  <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-zinc-900/95 px-4 py-2 backdrop-blur-sm">
                    <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                      {week}
                    </p>
                  </div>
                )}
                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 px-4 py-3",
                    day.isToday && "bg-amber-400/[0.06]",
                    !hasActivity && "opacity-60"
                  )}
                >
                  <div>
                    <p
                      className={cn(
                        "text-sm font-medium",
                        day.isToday ? "text-amber-400" : "text-white"
                      )}
                    >
                      {day.label}
                      {day.isToday && (
                        <span className="ml-2 text-xs font-normal text-amber-400/80">
                          Today
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Interest {formatPeso(day.interest)}
                      {day.principal > 0 &&
                        ` · Principal ${formatPeso(day.principal)}`}
                      {day.approvedWithdrawals > 0 &&
                        ` · Withdrawals −${formatPeso(day.approvedWithdrawals)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Net expected cashout</p>
                    <PesoAmount
                      amount={day.netExpectedCashout}
                      gold={day.netExpectedCashout > 0}
                      className={cn(
                        "text-base font-semibold",
                        day.netExpectedCashout <= 0 && "text-zinc-500"
                      )}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
