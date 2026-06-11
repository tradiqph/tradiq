"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { DataTable } from "@/components/console/data-table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { NETWORK_PAGE_SIZE } from "@/lib/console/member-network";
import { cn } from "@/lib/utils";

interface ReferralNetworkSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NetworkLevelSummary {
  level: number;
  label: string;
  count: number;
}

interface NetworkMemberRow {
  id: string;
  displayName: string;
  activeBots: number;
}

export function ReferralNetworkSheet({
  open,
  onOpenChange,
}: ReferralNetworkSheetProps) {
  const { user } = useAuth();
  const [levels, setLevels] = useState<NetworkLevelSummary[]>([]);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [members, setMembers] = useState<NetworkMemberRow[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!user) return;
    setLoadingSummary(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/referral/network", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load network");
        return;
      }
      setLevels(data.levels ?? []);
    } finally {
      setLoadingSummary(false);
    }
  }, [user]);

  const fetchLevelMembers = useCallback(async () => {
    if (!user) return;
    setLoadingMembers(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({
        level: String(selectedLevel),
        search: query,
        limit: String(NETWORK_PAGE_SIZE),
        offset: String(offset),
      });
      const res = await fetch(`/api/referral/network?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load network members");
        return;
      }
      setMembers(data.members ?? []);
      setTotal(data.total ?? 0);
      setHasMore(Boolean(data.hasMore));
    } finally {
      setLoadingMembers(false);
    }
  }, [user, selectedLevel, query, offset]);

  useEffect(() => {
    if (!open) return;
    setSelectedLevel(1);
    setSearch("");
    setQuery("");
    setOffset(0);
    void fetchSummary();
  }, [open, fetchSummary]);

  useEffect(() => {
    if (!open) return;
    void fetchLevelMembers();
  }, [open, selectedLevel, query, offset, fetchLevelMembers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setQuery(search.trim());
  };

  const pageStart = members.length === 0 ? 0 : offset + 1;
  const pageEnd = offset + members.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85vh] flex-col border-amber-500/20 bg-zinc-950"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Users className="h-4 w-4 text-amber-400" />
            Your network
          </SheetTitle>
          <p className="text-sm text-zinc-500">
            Downline members and their active bots
          </p>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
          {error ? (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {(levels.length > 0
                  ? levels
                  : [1, 2, 3, 4, 5].map((level) => ({
                      level,
                      label: `L${level}`,
                      count: 0,
                    }))
                ).map((level) => (
                  <button
                    key={level.level}
                    type="button"
                    onClick={() => {
                      setSelectedLevel(level.level);
                      setOffset(0);
                    }}
                    className={cn(
                      "cursor-pointer rounded-full px-3 py-1 text-xs",
                      selectedLevel === level.level
                        ? "bg-amber-500/20 text-amber-400"
                        : "text-zinc-500 hover:text-white"
                    )}
                  >
                    L{level.level}
                    <span className="ml-1 text-[10px] opacity-80">
                      ({loadingSummary ? "…" : level.count})
                    </span>
                  </button>
                ))}
              </div>

              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name"
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 py-2 pr-3 pl-9 text-sm text-white placeholder:text-zinc-600"
                />
              </form>

              {loadingMembers && members.length === 0 ? (
                <p className="text-sm text-zinc-500">Loading members...</p>
              ) : (
                <DataTable
                  data={members}
                  rowKey={(row) => row.id}
                  emptyMessage={`No L${selectedLevel} members found`}
                  columns={[
                    {
                      key: "name",
                      header: "Name",
                      primary: true,
                      cell: (row) => (
                        <p className="text-white">{row.displayName}</p>
                      ),
                    },
                    {
                      key: "bots",
                      header: "Active bots",
                      cell: (row) => row.activeBots,
                    },
                  ]}
                />
              )}

              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <p className="text-xs text-zinc-500">
                  {members.length === 0
                    ? "No members on this page"
                    : `Showing ${pageStart}–${pageEnd} of ${total}`}
                </p>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    disabled={offset <= 0 || loadingMembers}
                    onClick={() =>
                      setOffset((current) =>
                        Math.max(0, current - NETWORK_PAGE_SIZE)
                      )
                    }
                    className="cursor-pointer text-xs text-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!hasMore || loadingMembers}
                    onClick={() =>
                      setOffset((current) => current + NETWORK_PAGE_SIZE)
                    }
                    className="cursor-pointer text-xs text-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
