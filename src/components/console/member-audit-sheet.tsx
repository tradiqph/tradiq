"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import { ConsoleError } from "@/components/console/console-error";
import { ConsoleLoader } from "@/components/console/console-loader";
import { PesoAmount } from "@/components/ui/peso-amount";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TransactionListItem } from "@/components/wallet/transaction-list-item";
import { useAuth } from "@/hooks/use-auth";
import {
  AUDIT_FILTERS,
  type AuditBotRow,
  type AuditSummary,
  type AuditTransactionFilter,
  type AuditTransactionRow,
} from "@/lib/console/member-audit";
import { formatPeso } from "@/lib/finance";
import { groupTransactionsByDate } from "@/lib/group-transactions-by-date";
import { Transaction } from "@/types";
import { cn } from "@/lib/utils";

interface MemberAuditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    displayName: string;
    email: string;
  } | null;
}

interface AuditResponse {
  summary: AuditSummary;
  bots: AuditBotRow[];
  transactions: AuditTransactionRow[];
  nextCursor: string | null;
  hasMore: boolean;
  totalMatching: number;
}

function toDisplayTransaction(
  tx: AuditTransactionRow
): Transaction & { id: string } {
  const date = tx.createdAt ? new Date(tx.createdAt) : new Date();
  return {
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    status: tx.status,
    title: tx.title,
    subtitle: tx.subtitle,
    metadata: tx.metadata,
    createdAt: { toDate: () => date } as Transaction["createdAt"],
  };
}

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white/[0.02] p-3",
        highlight ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-white/5"
      )}
    >
      <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
        {label}
      </p>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
      {sub ? <p className="mt-0.5 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

export function MemberAuditSheet({
  open,
  onOpenChange,
  member,
}: MemberAuditSheetProps) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<AuditTransactionFilter>("all");
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [bots, setBots] = useState<AuditBotRow[]>([]);
  const [transactions, setTransactions] = useState<AuditTransactionRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalMatching, setTotalMatching] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [botsExpanded, setBotsExpanded] = useState(true);

  const fetchAudit = useCallback(
    async (opts: {
      filterValue: AuditTransactionFilter;
      cursor: string | null;
      append: boolean;
    }) => {
      if (!user || !member) return;

      if (opts.append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const token = await user.getIdToken();
        const params = new URLSearchParams({ filter: opts.filterValue });
        if (opts.cursor) params.set("cursor", opts.cursor);

        const res = await fetch(
          `/api/console/members/${member.id}/audit?${params}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = (await res.json()) as AuditResponse & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to load audit");
          return;
        }

        setSummary(data.summary);
        setBots(data.bots ?? []);
        setTransactions((current) =>
          opts.append
            ? [...current, ...(data.transactions ?? [])]
            : (data.transactions ?? [])
        );
        setNextCursor(data.nextCursor ?? null);
        setHasMore(Boolean(data.hasMore));
        setTotalMatching(data.totalMatching ?? 0);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, member]
  );

  useEffect(() => {
    if (!open || !member) return;
    setFilter("all");
    setTransactions([]);
    void fetchAudit({ filterValue: "all", cursor: null, append: false });
  }, [open, member, fetchAudit]);

  const handleFilterChange = (next: AuditTransactionFilter) => {
    setFilter(next);
    void fetchAudit({ filterValue: next, cursor: null, append: false });
  };

  const handleLoadMore = () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    void fetchAudit({ filterValue: filter, cursor: nextCursor, append: true });
  };

  const displayTransactions = useMemo(
    () => transactions.map(toDisplayTransaction),
    [transactions]
  );

  const groups = useMemo(
    () => groupTransactionsByDate(displayTransactions),
    [displayTransactions]
  );

  const activeBots = bots.filter((b) => b.status === "active");
  const visibleBots = botsExpanded ? bots : activeBots.slice(0, 3);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-amber-500/20 bg-zinc-950 sm:max-w-2xl"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-left text-white">
            <ClipboardList className="h-4 w-4 text-amber-400" />
            Audit Account
          </SheetTitle>
          {member ? (
            <p className="text-left text-sm text-zinc-500">
              {member.displayName || member.email}
              {member.displayName ? ` · ${member.email}` : ""}
            </p>
          ) : null}
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pt-2">
          {error ? (
            <ConsoleError message={error} />
          ) : loading && !summary ? (
            <ConsoleLoader variant="section" label="Loading audit" />
          ) : summary ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <SummaryCard
                  label="Current wallet"
                  value={<PesoAmount amount={summary.walletBalance} gold />}
                />
                <SummaryCard
                  label="Total earned"
                  value={<PesoAmount amount={summary.totalEarned} />}
                  sub={`Bot ${formatPeso(summary.totalBotEarnings)} · Referral ${formatPeso(summary.totalReferralEarnings)}`}
                  highlight={summary.earnedMatchesWithdrawals}
                />
                <SummaryCard
                  label="Total withdrawal"
                  value={<PesoAmount amount={summary.totalWithdrawn} />}
                  sub={
                    summary.earnedMatchesWithdrawals
                      ? "Same as total earned"
                      : undefined
                  }
                  highlight={summary.earnedMatchesWithdrawals}
                />
              </div>

              {summary.earnedMatchesWithdrawals && (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200">
                  Total earned and total withdrawal are the same (
                  {formatPeso(summary.totalEarned)})
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <SummaryCard
                  label="Total deposited"
                  value={<PesoAmount amount={summary.totalDeposited} />}
                />
                <SummaryCard
                  label="Expected daily earnings"
                  value={
                    <PesoAmount amount={summary.bots.expectedDailyEarnings} gold />
                  }
                  sub="3% on active bot principal"
                />
                <SummaryCard
                  label="Active bot principal"
                  value={<PesoAmount amount={summary.bots.activePrincipal} />}
                  sub={`${summary.bots.activeBotCount} active bot${summary.bots.activeBotCount === 1 ? "" : "s"}`}
                />
              </div>

              {summary.flags.length > 0 && (
                <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="flex items-center gap-2 text-xs font-medium text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Review suggested
                  </p>
                  <ul className="space-y-1">
                    {summary.flags.map((flag) => (
                      <li
                        key={flag.id}
                        className={cn(
                          "text-xs",
                          flag.severity === "critical"
                            ? "text-red-300"
                            : "text-amber-200/90"
                        )}
                      >
                        {flag.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                  Withdrawal breakdown
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-zinc-500">Pending</p>
                    <p className="font-medium text-white">
                      {summary.withdrawals.pending.count} ·{" "}
                      {formatPeso(summary.withdrawals.pending.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Approved</p>
                    <p className="font-medium text-emerald-400">
                      {summary.withdrawals.approved.count} ·{" "}
                      {formatPeso(summary.withdrawals.approved.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Rejected</p>
                    <p className="font-medium text-zinc-400">
                      {summary.withdrawals.rejected.count} ·{" "}
                      {formatPeso(summary.withdrawals.rejected.amount)}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-zinc-600">
                  Ledger credits {formatPeso(summary.credits)} · debits{" "}
                  {formatPeso(summary.debits)} · balance delta{" "}
                  {formatPeso(summary.balanceDelta)}
                </p>
              </div>

              {bots.length > 0 && (
                <div className="rounded-xl border border-white/5 bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => setBotsExpanded((v) => !v)}
                    className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left"
                  >
                    <p className="text-xs font-medium text-zinc-400">
                      Bot investments ({bots.length})
                    </p>
                    {bots.length > 3 ? (
                      botsExpanded ? (
                        <ChevronUp className="h-4 w-4 text-zinc-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-zinc-500" />
                      )
                    ) : null}
                  </button>
                  <div className="overflow-x-auto border-t border-white/5">
                    <table className="w-full min-w-[480px] text-left text-xs">
                      <thead>
                        <tr className="text-zinc-500">
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Principal</th>
                          <th className="px-3 py-2 font-medium">Daily</th>
                          <th className="px-3 py-2 font-medium">Accrued</th>
                          <th className="px-3 py-2 font-medium">Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleBots.map((bot) => (
                          <tr
                            key={bot.id}
                            className="border-t border-white/5 text-zinc-300"
                          >
                            <td className="px-3 py-2 capitalize">{bot.status}</td>
                            <td className="px-3 py-2">
                              <PesoAmount amount={bot.amount} />
                            </td>
                            <td className="px-3 py-2">
                              <PesoAmount amount={bot.dailyDue} />
                            </td>
                            <td className="px-3 py-2">
                              <PesoAmount amount={bot.totalAccrued} />
                            </td>
                            <td className="px-3 py-2">
                              {bot.daysAccrued}/{bot.termDays}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <div className="mb-2 flex gap-3 overflow-x-auto border-b border-white/5 pb-1">
                  {AUDIT_FILTERS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleFilterChange(id)}
                      className={cn(
                        "shrink-0 cursor-pointer pb-2 text-xs font-medium transition-colors",
                        filter === id
                          ? "border-b-2 border-amber-400 text-amber-400"
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <p className="mb-3 text-[10px] text-zinc-600">
                  Showing {transactions.length} of {totalMatching}{" "}
                  {filter === "all" ? "transactions" : `${filter.replace("_", " ")} items`}
                </p>

                {loading && transactions.length === 0 ? (
                  <ConsoleLoader variant="section" label="Loading transactions" />
                ) : transactions.length === 0 ? (
                  <div className="rounded-xl border border-white/5 p-6 text-center text-sm text-zinc-500">
                    No transactions in this filter
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groups.map((group) => (
                      <div key={group.label}>
                        <p className="mb-2 text-xs font-medium text-zinc-500">
                          {group.label}
                        </p>
                        <div className="space-y-2">
                          {group.items.map((tx, index) => (
                            <div
                              key={tx.id}
                              className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
                            >
                              <TransactionListItem
                                tx={tx}
                                isLast={index === group.items.length - 1}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {hasMore && (
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={handleLoadMore}
                    className="mt-4 w-full cursor-pointer rounded-lg border border-white/10 py-2 text-xs text-zinc-400 disabled:opacity-50"
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
