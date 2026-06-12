"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ConsoleError } from "@/components/console/console-error";
import { ConsoleLoader } from "@/components/console/console-loader";
import { StatCard } from "@/components/console/stat-card";
import { PesoAmount } from "@/components/ui/peso-amount";
import { useConsoleFetch } from "@/hooks/use-console-fetch";
import { formatPeso } from "@/lib/finance";
import {
  addManilaMonths,
  LIABILITY_CALENDAR_MIN_MONTH,
  manilaCurrentMonthKey,
} from "@/lib/manila-time";
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
  isPast: boolean;
}

interface LiabilityCalendarResponse {
  month: string;
  monthLabel: string;
  minMonth: string;
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

export function LiabilityCalendar() {
  const [monthKey, setMonthKey] = useState(manilaCurrentMonthKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const canGoPrev = monthKey > LIABILITY_CALENDAR_MIN_MONTH;

  const { data, loading, error } = useConsoleFetch<LiabilityCalendarResponse>(
    `/api/console/liability-calendar?month=${monthKey}`,
    [monthKey]
  );

  const monthLabel = data?.monthLabel ?? monthKey;

  useLayoutEffect(() => {
    if (!data || loading || data.month !== monthKey) return;

    const container = scrollRef.current;
    if (!container) return;

    const todayEl = todayRef.current;
    if (todayEl && data.days.some((day) => day.isToday)) {
      const containerTop = container.getBoundingClientRect().top;
      const todayTop = todayEl.getBoundingClientRect().top;
      container.scrollTop += todayTop - containerTop;
    } else {
      container.scrollTop = 0;
    }
  }, [data, loading, monthKey]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Estimated Daily Liability
          </h2>
          <p className="text-sm text-zinc-500">
            Expected bot payouts by calendar day (Philippine time). Withdrawals
            shown for reference only.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-zinc-900/60 p-1">
          <button
            type="button"
            onClick={() => setMonthKey((m) => addManilaMonths(m, -1))}
            disabled={!canGoPrev || loading}
            aria-label="Previous month"
            className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-[9rem] px-2 text-center text-sm font-medium text-white">
            {loading ? "Loading…" : monthLabel}
          </p>
          <button
            type="button"
            onClick={() => setMonthKey((m) => addManilaMonths(m, 1))}
            disabled={loading}
            aria-label="Next month"
            className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading && !data && (
        <ConsoleLoader variant="section" label="Loading calendar" />
      )}

      {error && !data && (
        <ConsoleError message={error ?? "Failed to load liability calendar"} />
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total commissions paid"
              value={formatPeso(data.commissionsSummary.totalCommissionsPaid)}
              sub="Paid to uplines only"
            />
            <StatCard
              label="Monthly gross liability"
              value={formatPeso(data.totals.grossLiability)}
              sub="Interest + principal for this month"
            />
            <StatCard
              label="Monthly approved withdrawals"
              value={formatPeso(data.totals.approvedWithdrawals)}
              sub="By approval date"
            />
            <StatCard
              label="Monthly net expected cashout"
              value={formatPeso(data.totals.netExpectedCashout)}
              sub="Gross liability − approved withdrawals"
            />
          </div>

          <div
            ref={scrollRef}
            className={cn(
              "surface-flat max-h-[480px] overflow-y-auto transition-opacity",
              loading && "opacity-60"
            )}
          >
            <div className="divide-y divide-white/[0.06]">
              {data.days.map((day) => {
                const hasActivity =
                  day.grossLiability > 0 || day.approvedWithdrawals > 0;

                return (
                  <div
                    key={day.dateKey}
                    ref={day.isToday ? todayRef : undefined}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-2 px-4 py-3",
                      day.isToday && "bg-amber-400/[0.06]",
                      day.isPast && !day.isToday && "opacity-75",
                      !hasActivity && "opacity-50"
                    )}
                  >
                    <div>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          day.isToday
                            ? "text-amber-400"
                            : day.isPast
                              ? "text-zinc-400"
                              : "text-white"
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
                      <p className="text-xs text-zinc-500">Expected bot payout</p>
                      <PesoAmount
                        amount={day.grossLiability}
                        gold={day.grossLiability > 0 && !day.isPast}
                        className={cn(
                          "text-base font-semibold",
                          day.grossLiability <= 0 && "text-zinc-500",
                          day.isPast &&
                            day.grossLiability > 0 &&
                            "text-zinc-300"
                        )}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
