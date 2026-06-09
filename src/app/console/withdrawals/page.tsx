"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ConsoleError } from "@/components/console/console-error";
import { GoldButton } from "@/components/ui/gold-button";
import { PesoAmount } from "@/components/ui/peso-amount";
import { formatPeso } from "@/lib/finance";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TabStatus = "pending" | "approved" | "rejected" | "all";

interface WithdrawalRequestItem {
  id: string;
  userEmail: string;
  amount: number;
  processingFee?: number;
  netPayout?: number;
  status: string;
  accountSnapshot: {
    label: string;
    accountType: string;
    accountNumber: string;
    accountName: string;
    bankName?: string;
  };
  createdAt: { seconds: number };
  reviewedAt?: { seconds: number };
}

const tabs: { key: TabStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function ConsoleWithdrawalsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabStatus>("pending");
  const [requests, setRequests] = useState<WithdrawalRequestItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    setFetchError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/console/withdrawals?status=${tab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        setFetchError(data.error ?? "Failed to load withdrawals");
        return;
      }
      setRequests(data.requests);
    } finally {
      setFetching(false);
    }
  }, [user, tab]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (
    requestId: string,
    action: "approve" | "reject"
  ) => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/console/withdrawals", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ requestId, action }),
    });
    if (res.ok) {
      toast.success(`Request ${action}d`);
      fetchRequests();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Withdrawals</h1>
        <p className="text-sm text-zinc-500">Manage cashout requests</p>
      </div>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs cursor-pointer",
              tab === t.key
                ? "bg-amber-500/20 text-amber-400"
                : "text-zinc-500 hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {fetchError ? (
        <ConsoleError message={fetchError} />
      ) : fetching ? (
        <p className="text-zinc-500">Loading...</p>
      ) : requests.length === 0 ? (
        <div className="surface-flat p-8 text-center text-zinc-500">
          No {tab === "all" ? "" : tab} withdrawal requests
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="surface-flat p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <span className="text-white">{req.userEmail}</span>
                  <p className="text-xs text-zinc-500 capitalize">
                    {req.status}
                  </p>
                </div>
                <div className="text-right">
                  <PesoAmount amount={req.amount} gold />
                  {req.netPayout != null && req.netPayout !== req.amount && (
                    <p className="text-[10px] text-emerald-400">
                      Payout: {formatPeso(req.netPayout)}
                    </p>
                  )}
                </div>
              </div>
              {req.processingFee != null && req.processingFee > 0 && (
                <p className="mb-1 text-xs text-zinc-500">
                  Fee (4%): ₱{req.processingFee.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
              )}
              <p className="text-xs text-zinc-500">
                {req.accountSnapshot.label} · {req.accountSnapshot.accountType}
                {req.accountSnapshot.bankName
                  ? ` · ${req.accountSnapshot.bankName}`
                  : ""}{" "}
                · {req.accountSnapshot.accountNumber}
              </p>
              <p className="text-xs text-zinc-500">
                {req.accountSnapshot.accountName}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Requested:{" "}
                {req.createdAt
                  ? format(new Date(req.createdAt.seconds * 1000), "PPpp")
                  : "—"}
                {req.reviewedAt &&
                  ` · Reviewed: ${format(new Date(req.reviewedAt.seconds * 1000), "PPpp")}`}
              </p>
              {req.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <GoldButton
                    onClick={() => handleAction(req.id, "approve")}
                    className="flex-1"
                  >
                    Approve
                  </GoldButton>
                  <button
                    type="button"
                    onClick={() => handleAction(req.id, "reject")}
                    className="flex-1 cursor-pointer rounded-md border border-red-500/30 py-2 text-sm text-red-400"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
