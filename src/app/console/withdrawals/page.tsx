"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ConsoleError } from "@/components/console/console-error";
import { ConsoleLoader } from "@/components/console/console-loader";
import { GoldButton } from "@/components/ui/gold-button";
import { Input } from "@/components/ui/input";
import { PesoAmount } from "@/components/ui/peso-amount";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPeso } from "@/lib/finance";
import { resolveWithdrawalPayoutPeso } from "@/lib/console/instapay-export";
import { isActionablePayoutFailure } from "@/lib/console/withdrawals-list";
import { formatManilaDateLabel, manilaTodayKey } from "@/lib/manila-time";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type TabStatus =
  | "pending"
  | "failed"
  | "refunded"
  | "approved"
  | "rejected"
  | "all";

interface WithdrawalRequestItem {
  id: string;
  userEmail: string;
  amount: number;
  processingFee?: number;
  netPayout?: number;
  status: string;
  rejectionReason?: string;
  accountSnapshot: {
    label: string;
    accountType: string;
    accountNumber: string;
    accountName: string;
    bankName?: string;
  };
  createdAt: { seconds: number };
  reviewedAt?: { seconds: number };
  paidAt?: { seconds: number };
  payoutFailedAt?: { seconds: number };
  payoutFailureAcknowledgedAt?: { seconds: number };
  paymongoTransferId?: string;
  paymongoTransferStatus?: "pending" | "succeeded" | "failed";
  payError?: string;
  payoutInFlight?: boolean;
  payoutAttempts?: {
    transferId: string;
    status: "pending" | "succeeded" | "failed";
    centavos: number;
    attemptedAt: { seconds: number };
    failedAt?: { seconds: number };
    error?: string;
    attemptedBy: string;
  }[];
  failedAttemptsOnDate?: number;
  unresolvedFailure?: boolean;
}

const tabs: { key: TabStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "failed", label: "Failed" },
  { key: "refunded", label: "Refunded" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function payoutStatusLabel(status?: string): string {
  if (status === "succeeded") return "succeeded";
  if (status === "failed") return "failed";
  return "pending";
}

function formatTimestamp(ts?: { seconds: number }): string {
  if (!ts?.seconds) return "—";
  return format(new Date(ts.seconds * 1000), "PPpp");
}

export default function ConsoleWithdrawalsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabStatus>("pending");
  const [selectedDate, setSelectedDate] = useState(manilaTodayKey);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState<WithdrawalRequestItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [actingOn, setActingOn] = useState<{
    requestId: string;
    action:
      | "approve"
      | "reject"
      | "refund"
      | "pay"
      | "sync"
      | "moveToApproved"
      | "acknowledgePayout";
  } | null>(null);
  const [payConfirm, setPayConfirm] = useState<WithdrawalRequestItem | null>(
    null
  );
  const [refundConfirm, setRefundConfirm] =
    useState<WithdrawalRequestItem | null>(null);
  const [acknowledgeConfirm, setAcknowledgeConfirm] =
    useState<WithdrawalRequestItem | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchRequests = useCallback(async (options?: {
    background?: boolean;
    status?: TabStatus;
  }) => {
    if (!user) return;
    if (!options?.background) {
      setFetching(true);
    }
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        status: options?.status ?? tab,
        date: selectedDate,
      });
      if (search.trim()) params.set("search", search.trim());

      const token = await user.getIdToken();
      const res = await fetch(`/api/console/withdrawals?${params}`, {
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
      if (!options?.background) {
        setFetching(false);
      }
    }
  }, [user, tab, selectedDate, search]);

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
    action:
      | "approve"
      | "reject"
      | "refund"
      | "moveToApproved"
      | "acknowledgePayout"
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
        if (action === "refund") {
          toast.success("Balance refunded to member");
          setRefundConfirm(null);
          setTab("refunded");
          await fetchRequests({ status: "refunded" });
          return;
        } else if (action === "moveToApproved") {
          toast.success("Withdrawal moved to Approved");
        } else if (action === "acknowledgePayout") {
          toast.success("Payout marked as processed");
          setAcknowledgeConfirm(null);
        } else {
          toast.success(`Request ${action === "reject" ? "reject" : action}ed`);
        }
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

  const handleSyncPayout = async (req: WithdrawalRequestItem) => {
    if (!user || actingOn) return;

    setActingOn({ requestId: req.id, action: "sync" });
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/console/withdrawals/${req.id}/sync-payout`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.status === "failed") {
          toast.success("Payout marked as failed — check the Failed tab");
        } else if (data.status === "succeeded") {
          toast.success("Payout succeeded at PayMongo");
        } else {
          toast.message("Payout is still pending at PayMongo");
        }
        await fetchRequests({ background: true });
      } else {
        toast.error(
          typeof data.error === "string" ? data.error : "Failed to refresh status"
        );
      }
    } catch {
      toast.error("Failed to refresh payout status");
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
    req.paymongoTransferStatus === "succeeded" ||
    (Boolean(req.paymongoTransferId) &&
      req.paymongoTransferStatus !== "failed");

  const isPayoutFailed = (req: WithdrawalRequestItem) =>
    isActionablePayoutFailure(req);

  const emptyLabel =
    tab === "all"
      ? "withdrawal requests"
      : tab === "failed"
        ? "failed payouts"
        : tab === "refunded"
          ? "refunded payouts"
          : `${tab} withdrawal requests`;

  const usesPayoutFailedDate = tab === "failed" || tab === "refunded";

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

      <div className="flex flex-wrap gap-2">
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            {usesPayoutFailedDate ? "Payout failed date" : "Date"}
          </label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(e.target.value);
            }}
            className="border-white/10 bg-black/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            Search
          </label>
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search email, account, amount…"
            className="border-white/10 bg-black/40"
          />
        </div>
      </div>

      {fetchError ? (
        <ConsoleError message={fetchError} />
      ) : fetching && requests.length === 0 ? (
        <ConsoleLoader variant="section" />
      ) : requests.length === 0 ? (
        <div className="surface-flat p-8 text-center text-zinc-500">
          No {emptyLabel} for {formatManilaDateLabel(selectedDate)}
          {search.trim() ? " matching your search" : ""}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const payoutFailed = isPayoutFailed(req);
            const showPendingActions =
              req.status === "pending" && tab === "pending" && !payoutFailed;
            const showRecoveryActions =
              isPayoutFailed(req) &&
              (tab === "failed" || tab === "approved");
            const showRefreshStatus =
              req.paymongoTransferStatus === "pending" &&
              Boolean(req.paymongoTransferId?.startsWith("tr_")) &&
              (tab === "approved" || tab === "failed");
            const showFailedTabApprovePending =
              tab === "failed" &&
              req.status === "pending" &&
              req.paymongoTransferStatus === "failed";
            const showFailedTabApproveApproved =
              tab === "failed" &&
              req.status === "approved" &&
              req.unresolvedFailure === true;
            const showFailedTabApprove =
              showFailedTabApprovePending || showFailedTabApproveApproved;
            const failedAttemptsToday = req.failedAttemptsOnDate ?? 0;

            const handleFailedTabApprove = () => {
              if (req.status === "pending") {
                void handleAction(req.id, "moveToApproved");
                return;
              }
              setAcknowledgeConfirm(req);
            };

            return (
              <div key={req.id} className="surface-flat p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-white">{req.userEmail}</span>
                      {tab === "refunded" && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                          Refunded
                        </span>
                      )}
                      {tab === "failed" && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            req.unresolvedFailure
                              ? "bg-red-500/20 text-red-400"
                              : "bg-emerald-500/20 text-emerald-400"
                          )}
                        >
                          {req.unresolvedFailure ? "Unresolved" : "Resolved"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 capitalize">
                      {tab === "failed"
                        ? `Withdrawal ${req.status}`
                        : tab === "refunded"
                          ? "Balance refunded to member"
                          : req.status}
                    </p>
                    {(tab === "failed" || tab === "refunded") &&
                      failedAttemptsToday > 0 && (
                      <p className="mt-1 text-xs text-red-400">
                        {failedAttemptsToday} failed payout attempt
                        {failedAttemptsToday === 1 ? "" : "s"} on this date
                      </p>
                    )}
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
                  <p className="mb-1 text-xs font-medium text-red-400">
                    {req.payError}
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
                  Requested: {formatTimestamp(req.createdAt)}
                  {req.payoutFailedAt && (
                    <>
                      {" · Payout failed: "}
                      {formatTimestamp(req.payoutFailedAt)}
                    </>
                  )}
                  {!req.payoutFailedAt && payoutFailed && req.paidAt && (
                    <>
                      {" · Payout attempted: "}
                      {formatTimestamp(req.paidAt)}
                    </>
                  )}
                  {req.reviewedAt &&
                    ` · Reviewed: ${formatTimestamp(req.reviewedAt)}`}
                </p>
                {(tab === "failed" || tab === "refunded") &&
                  (req.payoutAttempts?.filter((a) => a.status === "failed")
                    .length ?? 0) > 0 && (
                    <div className="mt-2 space-y-1 rounded-lg border border-red-500/10 bg-red-500/5 p-2">
                      {req.payoutAttempts
                        ?.filter((attempt) => attempt.status === "failed")
                        .map((attempt) => (
                          <p
                            key={attempt.transferId}
                            className="text-[11px] text-red-300"
                          >
                            {formatTimestamp(
                              attempt.failedAt ?? attempt.attemptedAt
                            )}
                            {attempt.transferId.startsWith("tr_")
                              ? ` · ${attempt.transferId}`
                              : ""}
                            {attempt.error ? ` · ${attempt.error}` : ""}
                          </p>
                        ))}
                    </div>
                  )}
                {showRefreshStatus && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => void handleSyncPayout(req)}
                      disabled={actingOn !== null}
                      className="flex min-w-[7rem] cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-500/30 bg-zinc-500/10 px-4 py-2 text-sm text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actingOn?.requestId === req.id &&
                      actingOn.action === "sync" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Refreshing...
                        </>
                      ) : (
                        "Refresh status"
                      )}
                    </button>
                  </div>
                )}
                {showPendingActions && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPayConfirm(req)}
                      disabled={isPayDisabled(req)}
                      className="flex min-w-[7rem] flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 py-2 text-sm text-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
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
                      ) : (
                        "Pay"
                      )}
                    </button>
                    <GoldButton
                      onClick={() => void handleAction(req.id, "approve")}
                      disabled={actingOn !== null}
                      className="min-w-[7rem] flex-1 gap-2"
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
                      className="flex min-w-[7rem] flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-red-500/30 py-2 text-sm text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
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
                {showRecoveryActions && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPayConfirm(req)}
                      disabled={isPayDisabled(req)}
                      className="flex min-w-[7rem] flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 py-2 text-sm text-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actingOn?.requestId === req.id &&
                      actingOn.action === "pay" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Paying...
                        </>
                      ) : req.payoutInFlight ? (
                        "Pay in progress..."
                      ) : (
                        "Pay again"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefundConfirm(req)}
                      disabled={actingOn !== null}
                      className="flex min-w-[7rem] flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 py-2 text-sm text-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actingOn?.requestId === req.id &&
                      actingOn.action === "refund" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Refunding...
                        </>
                      ) : (
                        "Refund balance"
                      )}
                    </button>
                    {showFailedTabApprove && (
                      <GoldButton
                        onClick={handleFailedTabApprove}
                        disabled={actingOn !== null}
                        className="min-w-[7rem] flex-1 gap-2"
                      >
                        {actingOn?.requestId === req.id &&
                        (actingOn.action === "moveToApproved" ||
                          actingOn.action === "acknowledgePayout") ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Approving...
                          </>
                        ) : (
                          "Approve"
                        )}
                      </GoldButton>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
                {payConfirm.status === "approved"
                  ? "Sends a new payout via PayMongo InstaPay for this approved withdrawal."
                  : (
                    <>
                      Sends money via PayMongo InstaPay. You still need to{" "}
                      <span className="text-white">Approve</span> to close the
                      request.
                    </>
                  )}
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

      <Dialog
        open={refundConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setRefundConfirm(null);
        }}
      >
        <DialogContent className="border-amber-500/20 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>Refund balance to member</DialogTitle>
          </DialogHeader>
          {refundConfirm && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                PayMongo did not deliver this payout. The member&apos;s wallet
                will be credited back
                {refundConfirm.status === "approved"
                  ? " and their total withdrawn stat will be corrected"
                  : ""}{" "}
                and the request will be closed as rejected.
              </p>
              {refundConfirm.payError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm">
                  <p className="font-medium text-red-300">PayMongo payout error</p>
                  <p className="mt-1 text-red-200">{refundConfirm.payError}</p>
                </div>
              )}
              <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-sm">
                <p className="text-zinc-400">Member</p>
                <p className="text-white">{refundConfirm.userEmail}</p>
                <p className="mt-3 text-zinc-400">Refund amount</p>
                <p className="text-2xl font-semibold text-amber-400">
                  {formatPeso(refundConfirm.amount)}
                </p>
              </div>
              <GoldButton
                className="w-full"
                disabled={actingOn !== null}
                onClick={() => void handleAction(refundConfirm.id, "refund")}
              >
                {actingOn?.action === "refund" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Refunding...
                  </>
                ) : (
                  "Confirm refund"
                )}
              </GoldButton>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={acknowledgeConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setAcknowledgeConfirm(null);
        }}
      >
        <DialogContent className="border-amber-500/20 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>Mark payout as processed</DialogTitle>
          </DialogHeader>
          {acknowledgeConfirm && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                Mark this payout as processed? It will be removed from the Failed
                tab. Only confirm if payment was already delivered.
              </p>
              <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-sm">
                <p className="text-zinc-400">Member</p>
                <p className="text-white">{acknowledgeConfirm.userEmail}</p>
                <p className="mt-3 text-zinc-400">Net payout</p>
                <p className="text-2xl font-semibold text-emerald-400">
                  {formatPeso(
                    resolveWithdrawalPayoutPeso(
                      acknowledgeConfirm.amount,
                      acknowledgeConfirm.netPayout
                    )
                  )}
                </p>
              </div>
              <GoldButton
                className="w-full"
                disabled={actingOn !== null}
                onClick={() =>
                  void handleAction(
                    acknowledgeConfirm.id,
                    "acknowledgePayout"
                  )
                }
              >
                {actingOn?.action === "acknowledgePayout" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  "Confirm"
                )}
              </GoldButton>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
