"use client";

import { useState } from "react";
import { ConsoleError } from "@/components/console/console-error";
import { DataTable } from "@/components/console/data-table";
import { PesoAmount } from "@/components/ui/peso-amount";
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
  memberSince: string | null;
}

interface MembersResponse {
  members: Member[];
  nextCursor: string | null;
  hasMore: boolean;
}

export default function ConsoleMembersPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const { data, loading, error } = useConsoleFetch<MembersResponse>(
    `/api/console/members?search=${encodeURIComponent(query)}&limit=50`,
    [query]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(search.trim());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Members</h1>
        <p className="text-sm text-zinc-500">User roster and balances</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
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
        <button
          type="submit"
          className="cursor-pointer rounded-lg bg-amber-500/20 px-4 py-2 text-sm text-amber-400"
        >
          Search
        </button>
      </form>

      {loading ? (
        <p className="text-zinc-500">Loading members...</p>
      ) : error ? (
        <ConsoleError message={error} />
      ) : (
        <DataTable
          data={data?.members ?? []}
          rowKey={(m) => m.id}
          emptyMessage="No members found"
          columns={[
            {
              key: "name",
              header: "Member",
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
              key: "deposit",
              header: "Deposit",
              cell: (m) => formatPeso(m.depositBalance),
            },
            {
              key: "bots",
              header: "Active bots",
              cell: (m) => m.activeBots,
            },
            {
              key: "since",
              header: "Joined",
              cell: (m) =>
                m.memberSince
                  ? format(new Date(m.memberSince), "MMM d, yyyy")
                  : "—",
            },
          ]}
        />
      )}
    </div>
  );
}
