"use client";

import { useCallback, useEffect, useState } from "react";
import { ConsoleError } from "@/components/console/console-error";
import { ConsoleLoader } from "@/components/console/console-loader";
import { ConsoleTablePagination } from "@/components/console/console-table-pagination";
import { DataTable } from "@/components/console/data-table";
import { StatCard } from "@/components/console/stat-card";
import { PesoAmount } from "@/components/ui/peso-amount";
import { useAuth } from "@/hooks/use-auth";
import { CONSOLE_LIST_PAGE_SIZE } from "@/lib/console/pagination";
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
  total: number;
  pageSize: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export default function ConsoleCommissionsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [data, setData] = useState<CommissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);

  const fetchCommissions = useCallback(
    async (cursor: string | null) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          status,
          limit: String(CONSOLE_LIST_PAGE_SIZE),
        });
        if (cursor) params.set("cursor", cursor);

        const token = await user.getIdToken();
        const res = await fetch(`/api/console/commissions?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as CommissionsResponse & {
          error?: string;
        };
        if (!res.ok) {
          setError(json.error ?? "Failed to load commissions");
          return;
        }

        setData(json);
        setHasMore(Boolean(json.hasMore));
        setNextCursor(json.nextCursor ?? null);
      } finally {
        setLoading(false);
      }
    },
    [user, status]
  );

  useEffect(() => {
    setPage(1);
    setCursors([null]);
    void fetchCommissions(null);
  }, [fetchCommissions]);

  const goNext = () => {
    if (!hasMore || !nextCursor) return;
    const newPage = page + 1;
    setCursors((current) => [...current, nextCursor]);
    setPage(newPage);
    void fetchCommissions(nextCursor);
  };

  const goPrev = () => {
    if (page <= 1) return;
    const newPage = page - 1;
    const cursor = cursors[newPage - 1] ?? null;
    setPage(newPage);
    void fetchCommissions(cursor);
  };

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
          One-time upline payouts on bot subscriptions (7% · 3% · 2% · 1% · 1%)
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

      {loading && !data ? (
        <ConsoleLoader variant="page" label="Loading commissions" />
      ) : error ? (
        <ConsoleError message={error} />
      ) : (
        <div className="space-y-3">
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
                            .map(
                              (level) =>
                                `L${level.level} ${formatPeso(level.amount)}`
                            )
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
          <ConsoleTablePagination
            page={page}
            pageSize={CONSOLE_LIST_PAGE_SIZE}
            pageCount={data?.commissions.length ?? 0}
            total={data?.total ?? 0}
            hasMore={hasMore}
            loading={loading}
            onPrev={goPrev}
            onNext={goNext}
          />
        </div>
      )}
    </div>
  );
}
