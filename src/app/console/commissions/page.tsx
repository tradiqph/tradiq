"use client";

import { useState } from "react";
import { ConsoleError } from "@/components/console/console-error";
import { DataTable } from "@/components/console/data-table";
import { StatCard } from "@/components/console/stat-card";
import { PesoAmount } from "@/components/ui/peso-amount";
import { useConsoleFetch } from "@/hooks/use-console-fetch";
import { formatPeso } from "@/lib/finance";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type StatusFilter = "active" | "completed" | "all";

interface CommissionRow {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  amount: number;
  status: string;
  subscribedAt: string | null;
  referrerDisplayName: string | null;
  referrerEmail: string | null;
  directReferralCommission: number;
  subscriptionCommissionTotal: number;
  adminCommissionTotal: number;
  levelCommissions: {
    level: number;
    label: string;
    amount: number;
    recipient: "upline" | "admin";
  }[];
  memberReferralEarned: number;
}

interface CommissionsResponse {
  commissions: CommissionRow[];
  summary: {
    count: number;
    withReferrerCount: number;
    totalCommissionsPaid: number;
    totalAdminCommission: number;
    directCommissionsPaid: number;
    totalSubPrincipal: number;
  };
}

export default function ConsoleCommissionsPage() {
  const [status, setStatus] = useState<StatusFilter>("all");

  const { data, loading, error } = useConsoleFetch<CommissionsResponse>(
    `/api/console/commissions?status=${status}`,
    [status]
  );

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active bots" },
    { key: "completed", label: "Completed bots" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Commissions</h1>
        <p className="text-sm text-zinc-500">
          One-time upline payouts on bot subscriptions (15% · 3% · 2% · 1% · 1%)
        </p>
      </div>

      {data?.summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Total commissions paid"
            value={formatPeso(data.summary.totalCommissionsPaid)}
            sub="Paid to uplines only"
          />
          <StatCard
            label="Admin commission"
            value={formatPeso(data.summary.totalAdminCommission)}
            sub="Retained by company"
          />
          <StatCard
            label="Direct (L1) paid"
            value={formatPeso(data.summary.directCommissionsPaid)}
          />
          <StatCard
            label="Subscriptions"
            value={String(data.summary.count)}
            sub={`${data.summary.withReferrerCount} with upline`}
          />
          <StatCard
            label="Sub principal"
            value={formatPeso(data.summary.totalSubPrincipal)}
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
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading commissions...</p>
      ) : error ? (
        <ConsoleError message={error} />
      ) : (
        <DataTable
          data={data?.commissions ?? []}
          rowKey={(row) => row.id}
          emptyMessage="No bot subscriptions found"
          columns={[
            {
              key: "investor",
              header: "Investor",
              primary: true,
              cell: (row) => (
                <div>
                  <p className="text-white">{row.displayName || row.email}</p>
                  <p className="text-xs text-zinc-500">{row.email}</p>
                </div>
              ),
            },
            {
              key: "referrer",
              header: "Direct upline",
              cell: (row) =>
                row.referrerEmail ? (
                  <div>
                    <p className="text-white">
                      {row.referrerDisplayName || row.referrerEmail}
                    </p>
                    <p className="text-xs text-zinc-500">{row.referrerEmail}</p>
                  </div>
                ) : (
                  <span className="text-zinc-600">No referrer</span>
                ),
            },
            {
              key: "principal",
              header: "Sub amount",
              cell: (row) => <PesoAmount amount={row.amount} gold />,
            },
            {
              key: "l1",
              header: "L1 commission",
              cell: (row) =>
                row.directReferralCommission > 0 ? (
                  <PesoAmount amount={row.directReferralCommission} />
                ) : (
                  <span className="text-zinc-600">—</span>
                ),
            },
            {
              key: "total",
              header: "Upline payout",
              cell: (row) => {
                const uplineLevels = row.levelCommissions.filter(
                  (level) => level.recipient === "upline" && level.amount > 0
                );
                const adminLevels = row.levelCommissions.filter(
                  (level) => level.recipient === "admin" && level.amount > 0
                );

                return (
                  <div className="space-y-1.5">
                    <p className="text-amber-400">
                      {formatPeso(row.subscriptionCommissionTotal)}
                    </p>
                    {uplineLevels.length > 0 && (
                      <p className="text-[10px] text-zinc-500">
                        {uplineLevels
                          .map((level) => `L${level.level} ${formatPeso(level.amount)}`)
                          .join(" · ")}
                      </p>
                    )}
                    {adminLevels.map((level) => (
                      <div
                        key={`admin-${level.level}`}
                        className="rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2 py-1"
                      >
                        <p className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
                          Admin Commission
                        </p>
                        <p className="text-xs text-zinc-300">
                          L{level.level} · {formatPeso(level.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              },
            },
            {
              key: "earned",
              header: "Investor referral earned",
              cell: (row) =>
                row.memberReferralEarned > 0 ? (
                  <PesoAmount amount={row.memberReferralEarned} />
                ) : (
                  <span className="text-zinc-600">—</span>
                ),
            },
            {
              key: "subscribed",
              header: "Subscribed",
              cell: (row) =>
                row.subscribedAt
                  ? format(new Date(row.subscribedAt), "MMM d, yyyy")
                  : "—",
            },
            {
              key: "status",
              header: "Bot status",
              cell: (row) => (
                <span className="text-xs capitalize text-zinc-400">
                  {row.status}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
