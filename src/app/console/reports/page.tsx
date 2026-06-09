"use client";

import { useState } from "react";
import { DataTable } from "@/components/console/data-table";
import { useAuth } from "@/hooks/use-auth";
import { Download } from "lucide-react";
import { toast } from "sonner";

const reportTypes = [
  { value: "platform-summary", label: "Platform summary" },
  { value: "daily-liability", label: "Daily liability" },
  { value: "withdrawals", label: "Withdrawals" },
  { value: "members", label: "Members" },
  { value: "investments", label: "Investments" },
];

export default function ConsoleReportsPage() {
  const { user } = useAuth();
  const [type, setType] = useState("platform-summary");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  const buildUrl = (format: "json" | "csv") => {
    const params = new URLSearchParams({ type, format });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/console/reports?${params}`;
  };

  const loadPreview = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(buildUrl("json"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setRows(json.rows ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(buildUrl("csv"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const columns =
    rows.length > 0
      ? Object.keys(rows[0])
          .filter((key) => key !== "_rowId")
          .map((key) => ({
          key,
          header: key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
          cell: (row: Record<string, unknown>) => String(row[key] ?? ""),
        }))
      : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-sm text-zinc-500">Export platform data</p>
      </div>

      <div className="surface-flat grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Report type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          >
            {reportTypes.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={loadPreview}
            disabled={loading}
            className="flex-1 cursor-pointer rounded-lg bg-amber-500/20 py-2 text-sm text-amber-400 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Preview"}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <DataTable
          data={rows.map((row, i) => ({ ...row, _rowId: String(i) }))}
          rowKey={(row) => row._rowId as string}
          columns={columns}
        />
      )}
    </div>
  );
}
