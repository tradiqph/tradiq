"use client";

import { useCallback, useEffect, useState } from "react";
import { ConsoleError } from "@/components/console/console-error";
import { ConsoleLoader } from "@/components/console/console-loader";
import { DataTable } from "@/components/console/data-table";
import { MemberActionsMenu } from "@/components/console/member-actions-menu";
import { MemberBotsSheet } from "@/components/console/member-bots-sheet";
import { StatCard } from "@/components/console/stat-card";
import { PesoAmount } from "@/components/ui/peso-amount";
import { useAuth } from "@/hooks/use-auth";
import { useConsoleFetch } from "@/hooks/use-console-fetch";
import { formatPeso } from "@/lib/finance";
import { format } from "date-fns";
import { Search } from "lucide-react";

interface Member {
  id: string;
  displayName: string;
  email: string;
  referralCode: string;
  role: string;
  walletBalance: number;
  depositBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  activeBots: number;
  activeBotPrincipal: number;
  memberSince: string | null;
}

interface MembersResponse {
  members: Member[];
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
  summary: {
    totalMembers: number;
    totalInvestedMembers: number;
  };
}

interface MembersFinancialSummary {
  totalDeposited: number;
  activePrincipal: number;
}

const PAGE_SIZE = 20;

type MemberSort = "email" | "newest";

const SORT_OPTIONS: { value: MemberSort; label: string }[] = [
  { value: "email", label: "Email (A–Z)" },
  { value: "newest", label: "Newest registered" },
];

export default function ConsoleMembersPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MemberSort>("email");
  const [members, setMembers] = useState<Member[]>([]);
  const [summary, setSummary] = useState<MembersResponse["summary"] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [botsMember, setBotsMember] = useState<Member | null>(null);

  const { data: financialSummary } = useConsoleFetch<MembersFinancialSummary>(
    "/api/console/stats"
  );

  const fetchMembers = useCallback(
    async (cursor: string | null) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const token = await user.getIdToken();
        const params = new URLSearchParams({
          search: query,
          limit: String(PAGE_SIZE),
          sort,
        });
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/console/members?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as MembersResponse & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to load members");
          return;
        }

        setMembers(data.members ?? []);
        setSummary(data.summary ?? null);
        setHasMore(Boolean(data.hasMore));
        setNextCursor(data.nextCursor ?? null);
      } finally {
        setLoading(false);
      }
    },
    [user, query, sort]
  );

  useEffect(() => {
    setPage(1);
    setCursors([null]);
    void fetchMembers(null);
  }, [fetchMembers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(search.trim());
  };

  const goNext = () => {
    if (!hasMore || !nextCursor) return;
    const newPage = page + 1;
    setCursors((current) => [...current, nextCursor]);
    setPage(newPage);
    void fetchMembers(nextCursor);
  };

  const goPrev = () => {
    if (page <= 1) return;
    const newPage = page - 1;
    const cursor = cursors[newPage - 1] ?? null;
    setPage(newPage);
    void fetchMembers(cursor);
  };

  const refetch = () => {
    const cursor = cursors[page - 1] ?? null;
    void fetchMembers(cursor);
  };

  const pageStart = members.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = (page - 1) * PAGE_SIZE + members.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Members</h1>
        <p className="text-sm text-zinc-500">User roster and balances</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total members"
          value={String(summary?.totalMembers ?? "—")}
          sub={query ? "Matching search" : "All registered users"}
        />
        <StatCard
          label="Invested members"
          value={String(summary?.totalInvestedMembers ?? "—")}
          sub="Members with active bots"
        />
        <StatCard
          label="Total deposited"
          value={formatPeso(financialSummary?.totalDeposited ?? 0)}
          sub="Lifetime deposits across all members"
        />
        <StatCard
          label="Total invested in bots"
          value={formatPeso(financialSummary?.activePrincipal ?? 0)}
          sub="Active bot principal only"
        />
      </div>

      <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or referral code"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 py-2 pr-3 pl-9 text-sm text-white placeholder:text-zinc-600"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as MemberSort)}
          className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          aria-label="Sort members"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="cursor-pointer rounded-lg bg-amber-500/20 px-4 py-2 text-sm text-amber-400"
        >
          Search
        </button>
      </form>

      {error ? (
        <ConsoleError message={error} />
      ) : loading && members.length === 0 ? (
        <ConsoleLoader variant="section" label="Loading members" />
      ) : (
        <div className="space-y-3">
          <DataTable
            data={members}
            rowKey={(m) => m.id}
            emptyMessage="No members found"
            columns={[
              {
                key: "name",
                header: "Member",
                primary: true,
                cell: (m) => (
                  <div>
                    <p className="text-white">{m.displayName || "—"}</p>
                    <p className="text-xs text-zinc-500">{m.email}</p>
                  </div>
                ),
              },
              {
                key: "referral",
                header: "Referral",
                cell: (m) => (
                  <span className="font-mono text-xs text-zinc-400">
                    {m.referralCode}
                  </span>
                ),
              },
              {
                key: "role",
                header: "Role",
                cell: (m) => (
                  <span className="text-xs capitalize text-zinc-400">
                    {m.role}
                  </span>
                ),
              },
              {
                key: "wallet",
                header: "Wallet",
                cell: (m) => <PesoAmount amount={m.walletBalance} />,
              },
              {
                key: "deposited",
                header: "Total deposited",
                cell: (m) =>
                  m.totalDeposited > 0 ? (
                    <PesoAmount amount={m.totalDeposited} />
                  ) : (
                    <span className="text-zinc-600">—</span>
                  ),
              },
              {
                key: "botInvested",
                header: "Bot invested",
                cell: (m) =>
                  m.activeBotPrincipal > 0 ? (
                    <div>
                      <PesoAmount amount={m.activeBotPrincipal} gold />
                      {m.activeBots > 1 && (
                        <p className="text-[10px] text-zinc-500">
                          {m.activeBots} active bots
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  ),
              },
              {
                key: "bots",
                header: "Active bots",
                cell: (m) =>
                  m.activeBots > 0 ? (
                    <button
                      type="button"
                      onClick={() => setBotsMember(m)}
                      className="cursor-pointer font-semibold text-amber-400 hover:text-amber-300"
                    >
                      {m.activeBots}
                    </button>
                  ) : (
                    <span className="text-zinc-400">0</span>
                  ),
              },
              {
                key: "since",
                header: "Joined",
                cell: (m) =>
                  m.memberSince
                    ? format(new Date(m.memberSince), "MMM d, yyyy")
                    : "—",
              },
              {
                key: "actions",
                header: "",
                hideOnMobile: true,
                cell: (m) => (
                  <MemberActionsMenu
                    member={{
                      id: m.id,
                      email: m.email,
                      displayName: m.displayName,
                      role: m.role,
                    }}
                    onUpdated={() => void refetch()}
                  />
                ),
              },
            ]}
          />

          <div className="flex flex-col gap-2 border-t border-white/5 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">
              {members.length === 0
                ? "No members on this page"
                : `Showing ${pageStart}–${pageEnd} of ${summary?.totalMembers ?? members.length}`}
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={goPrev}
                className="cursor-pointer text-xs text-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-zinc-500">Page {page}</span>
              <button
                type="button"
                disabled={!hasMore || loading}
                onClick={goNext}
                className="cursor-pointer text-xs text-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      <MemberBotsSheet
        open={botsMember !== null}
        onOpenChange={(open) => {
          if (!open) setBotsMember(null);
        }}
        member={
          botsMember
            ? {
                id: botsMember.id,
                displayName: botsMember.displayName,
                email: botsMember.email,
              }
            : null
        }
      />
    </div>
  );
}
