"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Calendar, X } from "lucide-react";
import { ConsoleError } from "@/components/console/console-error";
import { ConsoleLoader } from "@/components/console/console-loader";
import { MemberInvestmentsTable } from "@/components/console/member-investments-table";
import { StatCard } from "@/components/console/stat-card";
import { useConsoleFetch } from "@/hooks/use-console-fetch";
import { groupInvestmentsByMember } from "@/lib/console/investments-group";
import { formatPeso } from "@/lib/finance";
import {
  formatManilaDateLabel,
  manilaTodayKey,
} from "@/lib/manila-time";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type StatusFilter = "active" | "completed" | "all";

interface InvestmentsResponse {
  investments: Parameters<typeof groupInvestmentsByMember>[0];
  summary: {
    count: number;
    activePrincipal: number;
    todayLiability: number;
    dueTodayCount: number;
    completingTodayCount: number;
    remainingPayoutLiability: number;
  };
  filter: {
    payoutDay: string;
    botCount: number;
    liability: number | null;
  } | null;
  accrualStatus?: {
    lastRunAt: string | null;
    dueCount: number;
    processedCount: number;
    source: string | null;
    stale: boolean;
  } | null;
}

function InvestmentsContent() {
  const searchParams = useSearchParams();
  const initialDueToday = searchParams.get("dueToday") === "true";
  const initialPayoutDay =
    searchParams.get("payoutDay") ??
    (initialDueToday ? manilaTodayKey() : "");

  const [status, setStatus] = useState<StatusFilter>("active");
  const [payoutDay, setPayoutDay] = useState(initialPayoutDay);
  const dueTodayOnly = payoutDay === manilaTodayKey();

  const url = useMemo(() => {
    const params = new URLSearchParams({ status });
    if (payoutDay) {
      params.set("payoutDay", payoutDay);
      if (dueTodayOnly) params.set("dueToday", "true");
    }
    return `/api/console/investments?${params}`;
  }, [status, payoutDay, dueTodayOnly]);

  const { data, loading, error } = useConsoleFetch<InvestmentsResponse>(url, [
    status,
    payoutDay,
  ]);

  const memberGroups = useMemo(
    () => groupInvestmentsByMember(data?.investments ?? []),
    [data?.investments]
  );

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "all", label: "All" },
  ];

  const botsShownSub =
    memberGroups.length > 0
      ? `${data?.investments.length ?? 0} bots · ${memberGroups.length} members`
      : data?.summary?.completingTodayCount
        ? `${data.summary.completingTodayCount} completing today`
        : undefined;

  const dueColumnLabel = payoutDay
    ? `Due ${formatManilaDateLabel(payoutDay)}`
    : "Due today";

  const liabilityLabel = payoutDay
    ? `Liability · ${formatManilaDateLabel(payoutDay)}`
    : "Today's liability";

  const liabilityValue = payoutDay
    ? formatPeso(data?.filter?.liability ?? 0)
    : formatPeso(data?.summary?.todayLiability ?? 0);

  const liabilitySub = payoutDay
    ? `${data?.filter?.botCount ?? 0} bots on this day`
    : `${data?.summary?.dueTodayCount ?? 0} due today`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Bot Investments</h1>
        <p className="text-sm text-zinc-500">
          30-day copy trading bots · 3% daily payout · principal returned at maturity
        </p>
      </div>

      {data?.accrualStatus?.stale && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p className="font-medium">Bot accrual automation may be down</p>
          <p className="mt-1 text-xs text-amber-200/80">
            {data.accrualStatus.lastRunAt
              ? `Last successful accrual run: ${format(new Date(data.accrualStatus.lastRunAt), "MMM d, yyyy HH:mm")} (${data.accrualStatus.source ?? "unknown"}).`
              : "No accrual run recorded yet. Deploy dailyBotEarnings or run npm run accrual:confirm."}
            {" "}Scheduler should run every 15 minutes.
          </p>
        </div>
      )}

      {data?.summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active principal"
            value={formatPeso(data.summary.activePrincipal)}
          />
          <StatCard
            label={liabilityLabel}
            value={liabilityValue}
            sub={liabilitySub}
          />
          <StatCard
            label="Remaining payout"
            value={formatPeso(data.summary.remainingPayoutLiability)}
            sub="Interest + principal left"
          />
          <StatCard
            label="Bots shown"
            value={String(data.investments.length)}
            sub={botsShownSub}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatus(t.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs cursor-pointer",
              status === t.key
                ? "bg-amber-500/20 text-amber-400"
                : "text-zinc-500 hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}

        <div className="ml-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <Calendar className="h-3.5 w-3.5 text-amber-400" />
            <span className="sr-only">Payout day</span>
            <input
              type="date"
              value={payoutDay}
              onChange={(e) => setPayoutDay(e.target.value)}
              className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-white [color-scheme:dark]"
            />
          </label>
          {payoutDay && (
            <button
              type="button"
              onClick={() => setPayoutDay("")}
              className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs text-zinc-500 hover:text-white"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={dueTodayOnly}
              onChange={(e) => {
                if (e.target.checked) {
                  setPayoutDay(manilaTodayKey());
                } else if (payoutDay === manilaTodayKey()) {
                  setPayoutDay("");
                }
              }}
              className="accent-amber-500"
            />
            Due today only
          </label>
        </div>
      </div>

      {loading ? (
        <ConsoleLoader variant="page" label="Loading investments" />
      ) : error ? (
        <ConsoleError message={error} />
      ) : (
        <MemberInvestmentsTable
          groups={memberGroups}
          dueColumnLabel={dueColumnLabel}
          emptyMessage={
            payoutDay
              ? `No bot payouts on ${formatManilaDateLabel(payoutDay)}`
              : "No bot investments found"
          }
        />
      )}
    </div>
  );
}

export default function ConsoleInvestmentsPage() {
  return (
    <Suspense fallback={<ConsoleLoader variant="page" />}>
      <InvestmentsContent />
    </Suspense>
  );
}
