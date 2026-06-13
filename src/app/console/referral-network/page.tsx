"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { ConsoleError } from "@/components/console/console-error";
import { ConsoleLoader } from "@/components/console/console-loader";
import { DataTable } from "@/components/console/data-table";
import { StatCard } from "@/components/console/stat-card";
import { PesoAmount } from "@/components/ui/peso-amount";
import { useAuth } from "@/hooks/use-auth";
import { useConsoleFetch } from "@/hooks/use-console-fetch";
import { formatPeso } from "@/lib/finance";

interface ReferralNetworkRow {
  memberName: string;
  email: string;
  totalNetworkMembers: number;
  totalNetworkInvested: number;
  totalCommissionEarned: number;
}

interface ReferralNetworkResponse {
  rows: ReferralNetworkRow[];
}

export default function ConsoleReferralNetworkPage() {
  const { user } = useAuth();
  const { data, loading, error } = useConsoleFetch<ReferralNetworkResponse>(
    "/api/console/reports?type=referral-network&format=json"
  );

  const rows = data?.rows ?? [];

  const summary = useMemo(() => {
    const withNetwork = rows.filter((r) => r.totalNetworkMembers > 0);
    return {
      referrers: withNetwork.length,
      totalMembers: rows.reduce((s, r) => s + r.totalNetworkMembers, 0),
      totalEarned: rows.reduce((s, r) => s + r.totalCommissionEarned, 0),
    };
  }, [rows]);

  const exportCsv = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        "/api/console/reports?type=referral-network&format=csv",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "referral-network.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Referral Network</h1>
          <p className="text-sm text-zinc-500">
            Member downline size, network bot investment, and lifetime commission
            earned (L1–L5)
          </p>
        </div>
        <button
          type="button"
          onClick={() => void exportCsv()}
          disabled={loading || rows.length === 0}
          className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          CSV
        </button>
      </div>

      {!loading && rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Members with network"
            value={String(summary.referrers)}
          />
          <StatCard
            label="Total network members"
            value={String(summary.totalMembers)}
            sub="Across all uplines (L1–L5)"
          />
          <StatCard
            label="Commissions earned"
            value={formatPeso(summary.totalEarned)}
            sub="Lifetime upline payouts"
          />
        </div>
      )}

      {loading ? (
        <ConsoleLoader variant="page" label="Loading referral network" />
      ) : error ? (
        <ConsoleError message={error} />
      ) : (
        <DataTable
          data={rows}
          rowKey={(row) => row.email || row.memberName}
          emptyMessage="No members found"
          columns={[
            {
              key: "memberName",
              header: "Member",
              primary: true,
              cell: (row) => (
                <div>
                  <p className="text-white">{row.memberName}</p>
                  <p className="text-xs text-zinc-500">{row.email}</p>
                </div>
              ),
            },
            {
              key: "totalNetworkMembers",
              header: "Network",
              cell: (row) => (
                <span className="text-white">{row.totalNetworkMembers}</span>
              ),
            },
            {
              key: "totalNetworkInvested",
              header: "Network invested",
              cell: (row) =>
                row.totalNetworkInvested > 0 ? (
                  <PesoAmount amount={row.totalNetworkInvested} />
                ) : (
                  <span className="text-zinc-600">—</span>
                ),
            },
            {
              key: "totalCommissionEarned",
              header: "Commission earned",
              cell: (row) =>
                row.totalCommissionEarned > 0 ? (
                  <PesoAmount amount={row.totalCommissionEarned} gold />
                ) : (
                  <span className="text-zinc-600">—</span>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
