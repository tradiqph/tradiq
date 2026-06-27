"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Eye } from "lucide-react";
import { ConsoleError } from "@/components/console/console-error";
import { ConsoleLoader } from "@/components/console/console-loader";
import { ConsoleTablePagination } from "@/components/console/console-table-pagination";
import {
  RewardClaimSheet,
  type RewardClaimRow,
} from "@/components/console/reward-claim-sheet";
import { DataTable } from "@/components/console/data-table";
import { StatCard } from "@/components/console/stat-card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { CONSOLE_LIST_PAGE_SIZE } from "@/lib/console/pagination";
import {
  REWARD_STATUS_LABELS,
  REWARD_TIERS,
  type RewardClaimStatus,
} from "@/lib/rewards/config";
import { cn } from "@/lib/utils";

type StatusFilter = RewardClaimStatus | "all";

interface RewardsResponse {
  claims: RewardClaimRow[];
  summary: Record<RewardClaimStatus, number>;
  total: number;
  pageSize: number;
  hasMore: boolean;
  nextCursor: string | null;
  error?: string;
}

const statusTabs: { key: StatusFilter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "received", label: "Received" },
  { key: "all", label: "All" },
];

function formatClaimDate(value: { seconds: number } | null | undefined): string {
  if (!value?.seconds) return "—";
  return format(new Date(value.seconds * 1000), "MMM d, yyyy");
}

function statusBadgeClass(status: RewardClaimStatus): string {
  switch (status) {
    case "pending":
      return "text-amber-400";
    case "processing":
      return "text-blue-400";
    case "shipped":
      return "text-violet-400";
    case "received":
      return "text-emerald-400";
    default:
      return "text-zinc-400";
  }
}

export default function ConsoleRewardsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [rewardType, setRewardType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<RewardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [selectedClaim, setSelectedClaim] = useState<RewardClaimRow | null>(
    null
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchClaims = useCallback(
    async (cursor: string | null) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          status,
          rewardType,
          limit: String(CONSOLE_LIST_PAGE_SIZE),
        });
        if (cursor) params.set("cursor", cursor);
        if (search.trim()) params.set("search", search.trim());
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        const token = await user.getIdToken();
        const res = await fetch(`/api/console/rewards?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as RewardsResponse;
        if (!res.ok) {
          setError(json.error ?? "Failed to load reward claims");
          return;
        }
        setData(json);
        setHasMore(Boolean(json.hasMore));
        setNextCursor(json.nextCursor ?? null);
      } finally {
        setLoading(false);
      }
    },
    [user, status, rewardType, search, dateFrom, dateTo]
  );

  useEffect(() => {
    setPage(1);
    setCursors([null]);
    void fetchClaims(null);
  }, [fetchClaims]);

  const goNext = () => {
    if (!nextCursor) return;
    setCursors((prev) => [...prev, nextCursor]);
    setPage((p) => p + 1);
    void fetchClaims(nextCursor);
  };

  const goPrev = () => {
    if (page <= 1) return;
    const prevCursor = cursors[page - 2] ?? null;
    setPage((p) => p - 1);
    void fetchClaims(prevCursor);
  };

  const openClaim = (claim: RewardClaimRow) => {
    setSelectedClaim(claim);
    setSheetOpen(true);
  };

  const columns = [
    {
      key: "reference",
      header: "Reference",
      primary: true,
      cell: (row: RewardClaimRow) => (
        <span className="font-mono text-amber-400">{row.referenceNumber}</span>
      ),
    },
    {
      key: "member",
      header: "Member",
      cell: (row: RewardClaimRow) => (
        <div>
          <p className="font-medium text-white">{row.memberName}</p>
          <p className="text-xs text-zinc-500">{row.memberEmail}</p>
        </div>
      ),
    },
    {
      key: "reward",
      header: "Reward",
      cell: (row: RewardClaimRow) => (
        <span className="text-zinc-300">{row.rewardName}</span>
      ),
    },
    {
      key: "date",
      header: "Claim Date",
      cell: (row: RewardClaimRow) => (
        <span className="text-zinc-400">{formatClaimDate(row.claimedAt)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row: RewardClaimRow) => (
        <span className={cn("capitalize", statusBadgeClass(row.status))}>
          {REWARD_STATUS_LABELS[row.status]}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      hideOnMobile: false,
      cell: (row: RewardClaimRow) => (
        <button
          type="button"
          onClick={() => openClaim(row)}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-300 cursor-pointer hover:text-white"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">🎁 Rewards</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Track and fulfill member reward claims
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending Claims"
          value={String(data?.summary?.pending ?? "—")}
        />
        <StatCard
          label="Processing Claims"
          value={String(data?.summary?.processing ?? "—")}
        />
        <StatCard
          label="Shipped Claims"
          value={String(data?.summary?.shipped ?? "—")}
        />
        <StatCard
          label="Received Claims"
          value={String(data?.summary?.received ?? "—")}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatus(tab.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs cursor-pointer",
              status === tab.key
                ? "bg-amber-500/20 text-amber-400"
                : "text-zinc-500 hover:text-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            Reward type
          </label>
          <select
            value={rewardType}
            onChange={(e) => setRewardType(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          >
            <option value="all">All rewards</option>
            {REWARD_TIERS.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            Date from
          </label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border-white/10 bg-black/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            Date to
          </label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border-white/10 bg-black/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            Member name
          </label>
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search member…"
            className="border-white/10 bg-black/40"
          />
        </div>
      </div>

      {loading && !data ? (
        <ConsoleLoader label="Loading claims…" />
      ) : error ? (
        <ConsoleError message={error} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.claims ?? []}
            emptyMessage="No reward claims found"
            rowKey={(row) => row.id}
          />
          <ConsoleTablePagination
            page={page}
            pageSize={CONSOLE_LIST_PAGE_SIZE}
            pageCount={data?.claims.length ?? 0}
            total={data?.total ?? 0}
            hasMore={hasMore}
            loading={loading}
            onPrev={goPrev}
            onNext={goNext}
          />
        </>
      )}

      <RewardClaimSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        claim={selectedClaim}
        onUpdated={() => void fetchClaims(cursors[page - 1] ?? null)}
      />
    </div>
  );
}
