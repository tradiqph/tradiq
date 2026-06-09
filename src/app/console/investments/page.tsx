"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DataTable } from "@/components/console/data-table";
import { StatCard } from "@/components/console/stat-card";
import { PesoAmount } from "@/components/ui/peso-amount";
import { useConsoleFetch } from "@/hooks/use-console-fetch";
import { formatPeso } from "@/lib/finance";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type StatusFilter = "active" | "completed" | "all";

interface Investment {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  amount: number;
  status: string;
  daysAccrued: number;
  termDays: number;
  dailyDue: number;
  totalAccrued: number;
  dueToday: boolean;
  completingToday: boolean;
  subscribedAt: string | null;
  lastAccruedAt: string | null;
  nextPayoutAt: string | null;
}

interface InvestmentsResponse {
  investments: Investment[];
  summary: {
    count: number;
    activePrincipal: number;
    todayLiability: number;
    dueTodayCount: number;
    completingTodayCount: number;
  };
}

function InvestmentsContent() {
  const searchParams = useSearchParams();
  const initialDueToday = searchParams.get("dueToday") === "true";
  const [status, setStatus] = useState<StatusFilter>("active");
  const [dueTodayOnly, setDueTodayOnly] = useState(initialDueToday);

  const url = `/api/console/investments?status=${status}${dueTodayOnly ? "&dueToday=true" : ""}`;
  const { data, loading, error } = useConsoleFetch<InvestmentsResponse>(url, [
    status,
    dueTodayOnly,
  ]);

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Investments</h1>
        <p className="text-sm text-zinc-500">
          30-day bot subscriptions · 3% daily payout
        </p>
      </div>

      {data?.summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active principal"
            value={formatPeso(data.summary.activePrincipal)}
          />
          <StatCard
            label="Today's liability"
            value={formatPeso(data.summary.todayLiability)}
            sub={`${data.summary.dueTodayCount} due today`}
          />
          <StatCard
            label="Total shown"
            value={String(data.investments.length)}
          />
          {data.summary.completingTodayCount > 0 && (
            <StatCard
              label="Completing today"
              value={String(data.summary.completingTodayCount)}
            />
          )}
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
        <label className="ml-2 flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={dueTodayOnly}
            onChange={(e) => setDueTodayOnly(e.target.checked)}
            className="accent-amber-500"
          />
          Due today only
        </label>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading investments...</p>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : (
        <DataTable
          data={data?.investments ?? []}
          rowKey={(i) => i.id}
          emptyMessage="No investments found"
          columns={[
            {
              key: "member",
              header: "Member",
              cell: (i) => (
                <div>
                  <p className="text-white">{i.displayName || i.email}</p>
                  <p className="text-xs text-zinc-500">{i.email}</p>
                </div>
              ),
            },
            {
              key: "principal",
              header: "Principal",
              cell: (i) => <PesoAmount amount={i.amount} gold />,
            },
            {
              key: "day",
              header: "Day",
              cell: (i) => (
                <span className="font-mono text-amber-400">
                  {i.daysAccrued}/{i.termDays}
                </span>
              ),
            },
            {
              key: "daily",
              header: "Daily due",
              cell: (i) => formatPeso(i.dailyDue),
            },
            {
              key: "accrued",
              header: "Total accrued",
              cell: (i) => formatPeso(i.totalAccrued),
            },
            {
              key: "due",
              header: "Due today",
              cell: (i) =>
                i.dueToday ? (
                  <span className="text-amber-400">Yes</span>
                ) : (
                  <span className="text-zinc-600">No</span>
                ),
            },
            {
              key: "last",
              header: "Last payout",
              cell: (i) =>
                i.lastAccruedAt
                  ? format(new Date(i.lastAccruedAt), "MMM d, HH:mm")
                  : "—",
            },
            {
              key: "status",
              header: "Status",
              cell: (i) => (
                <span className="text-xs capitalize text-zinc-400">
                  {i.status}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

export default function ConsoleInvestmentsPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading...</p>}>
      <InvestmentsContent />
    </Suspense>
  );
}
