"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ConsoleError } from "@/components/console/console-error";
import { GoldButton } from "@/components/ui/gold-button";
import { PesoAmount } from "@/components/ui/peso-amount";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPeso } from "@/lib/finance";
import { resolveWithdrawalPayoutPeso } from "@/lib/console/instapay-export";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
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
  paymongoTransferId?: string;
  paymongoTransferStatus?: "pending" | "succeeded" | "failed";
  payError?: string;
  payoutInFlight?: boolean;
}

const tabs: { key: TabStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function payoutStatusLabel(status?: string): string {
  if (status === "succeeded") return "succeeded";
  if (status === "failed") return "failed";
  return "pending";
}

export default function ConsoleWithdrawalsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabStatus>("pending");
  const [requests, setRequests] = useState<WithdrawalRequestItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [actingOn, setActingOn] = useState<{
    requestId: string;
    action: "approve" | "reject" | "pay";
  } | null>(null);
  const [payConfirm, setPayConfirm] = useState<WithdrawalRequestItem | null>(
    null
  );

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

  const handleExportInstapay = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/console/withdrawals/export-instapay", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(
          typeof data.error === "string"
            ? data.error
            : "Failed to export InstaPay file"
        );
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="(.+)"/)?.[1] ??
        `instapay-pending-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("InstaPay export downloaded");
    } catch {
      toast.error("Failed to export InstaPay file");
    } finally {
      setExporting(false);
    }
  };

  const handleAction = async (
    requestId: string,
    action: "approve" | "reject"
  ) => {
    if (!user || actingOn) return;

    setActingOn({ requestId, action });
    try {
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
        await fetchRequests();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed");
      }
    } catch {
      toast.error("Failed to update withdrawal");
    } finally {
      setActingOn(null);
    }
  };

  const handlePay = async (req: WithdrawalRequestItem) => {
    if (!user || actingOn) return;

    setActingOn({ requestId: req.id, action: "pay" });
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/console/withdrawals/${req.id}/pay`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Payout sent via PayMongo");
        setPayConfirm(null);
        await fetchRequests();
      } else {
        toast.error(
          typeof data.error === "string" ? data.error : "Pay failed"
        );
      }
    } catch {
      toast.error("Failed to send payout");
    } finally {
      setActingOn(null);
    }
  };

  const isPayDisabled = (req: WithdrawalRequestItem) =>
    actingOn !== null ||
    req.payoutInFlight === true ||
    (Boolean(req.paymongoTransferId) &&
      req.paymongoTransferStatus !== "failed");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Withdrawals</h1>
          <p className="text-sm text-zinc-500">Manage cashout requests</p>
        </div>
        <button
          type="button"
          onClick={() => void handleExportInstapay()}
          disabled={exporting}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-400 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? "Exporting..." : "Export InstaPay (pending)"}
        </button>
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
                    Fee (4%): ₱
                    {req.processingFee.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                )}
                {req.paymongoTransferId && (
                  <p
                    className={cn(
                      "mb-1 text-xs",
                      req.paymongoTransferStatus === "failed"
                        ? "text-red-400"
                        : req.paymongoTransferStatus === "succeeded"
                          ? "text-emerald-400"
                          : "text-amber-400"
                    )}
                  >
                    Paid via API ·{" "}
                    {payoutStatusLabel(req.paymongoTransferStatus)}
                  </p>
                )}
                {req.payError && (
                  <p className="mb-1 text-xs text-red-400">{req.payError}</p>
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
                    <button
                      type="button"
                      onClick={() => setPayConfirm(req)}
                      disabled={isPayDisabled(req)}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 py-2 text-sm text-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actingOn?.requestId === req.id &&
                      actingOn.action === "pay" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Paying...
                        </>
                      ) : req.payoutInFlight ? (
                        "Pay in progress..."
                      ) : req.paymongoTransferId &&
                        req.paymongoTransferStatus !== "failed" ? (
                        "Paid"
                      ) : req.paymongoTransferStatus === "failed" ? (
                        "Retry Pay"
                      ) : (
                        "Pay"
                      )}
                    </button>
                    <GoldButton
                      onClick={() => void handleAction(req.id, "approve")}
                      disabled={actingOn !== null}
                      className="flex-1 gap-2"
                    >
                      {actingOn?.requestId === req.id &&
                      actingOn.action === "approve" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        "Approve"
                      )}
                    </GoldButton>
                    <button
                      type="button"
                      onClick={() => void handleAction(req.id, "reject")}
                      disabled={actingOn !== null}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-red-500/30 py-2 text-sm text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actingOn?.requestId === req.id &&
                      actingOn.action === "reject" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Rejecting...
                        </>
                      ) : (
                        "Reject"
                      )}
                    </button>
                  </div>
                )}
              </div>
          ))}
        </div>
      )}

      <Dialog
        open={payConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setPayConfirm(null);
        }}
      >
        <DialogContent className="border-amber-500/20 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>Send payout via PayMongo</DialogTitle>
          </DialogHeader>
          {payConfirm && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                Sends money via PayMongo InstaPay. You still need to{" "}
                <span className="text-white">Approve</span> to close the request.
              </p>
              <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-sm">
                <p className="text-zinc-400">Member</p>
                <p className="text-white">{payConfirm.userEmail}</p>
                <p className="mt-2 text-zinc-400">Account</p>
                <p className="text-white">
                  {payConfirm.accountSnapshot.accountName}
                </p>
                <p className="text-zinc-300">
                  {payConfirm.accountSnapshot.accountType}
                  {payConfirm.accountSnapshot.bankName
                    ? ` · ${payConfirm.accountSnapshot.bankName}`
                    : ""}{" "}
                  · {payConfirm.accountSnapshot.accountNumber}
                </p>
                <p className="mt-3 text-zinc-400">Net payout</p>
                <p className="text-2xl font-semibold text-emerald-400">
                  {formatPeso(
                    resolveWithdrawalPayoutPeso(
                      payConfirm.amount,
                      payConfirm.netPayout
                    )
                  )}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Description: TradIQ Withdrawal
                </p>
              </div>
              <GoldButton
                className="w-full"
                disabled={actingOn !== null}
                onClick={() => void handlePay(payConfirm)}
              >
                {actingOn?.action === "pay" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Confirm Pay"
                )}
              </GoldButton>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
