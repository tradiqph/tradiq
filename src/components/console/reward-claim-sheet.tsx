"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ConsoleLoader } from "@/components/console/console-loader";
import { GoldButton } from "@/components/ui/gold-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import {
  REWARD_STATUS_LABELS,
  COMMON_COURIERS,
  formatDeliveryAddress,
  type RewardClaimStatus,
} from "@/lib/rewards/config";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface RewardClaimRow {
  id: string;
  referenceNumber: string;
  userId: string;
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  rewardType: string;
  rewardName: string;
  rewardValue: number;
  deliveryAddress: {
    street: string;
    barangay: string;
    city: string;
    postalCode: string;
  };
  status: RewardClaimStatus;
  courier?: string;
  trackingNumber?: string;
  claimedAt: { seconds: number } | null;
  shippedAt?: { seconds: number } | null;
  receivedAt?: { seconds: number } | null;
}

interface StatusHistoryItem {
  id: string;
  status: RewardClaimStatus;
  updatedBy: string;
  updatedAt: { seconds: number } | null;
  courier?: string;
  trackingNumber?: string;
}

interface RewardClaimSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: RewardClaimRow | null;
  onUpdated: () => void;
}

function formatClaimDate(value: { seconds: number } | null | undefined): string {
  if (!value?.seconds) return "—";
  return format(new Date(value.seconds * 1000), "MMM d, yyyy h:mm a");
}

function statusBadgeClass(status: RewardClaimStatus): string {
  switch (status) {
    case "pending":
      return "bg-amber-500/15 text-amber-400";
    case "processing":
      return "bg-blue-500/15 text-blue-400";
    case "shipped":
      return "bg-violet-500/15 text-violet-400";
    case "received":
      return "bg-emerald-500/15 text-emerald-400";
    default:
      return "bg-zinc-800 text-zinc-400";
  }
}

export function RewardClaimSheet({
  open,
  onOpenChange,
  claim,
  onUpdated,
}: RewardClaimSheetProps) {
  const { user } = useAuth();
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [status, setStatus] = useState<RewardClaimStatus>("pending");
  const [courier, setCourier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!user || !claim) return;
    setLoadingHistory(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/console/rewards?claimId=${encodeURIComponent(claim.id)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (res.ok) {
        setHistory(json.history ?? []);
        setStatus(json.claim?.status ?? claim.status);
        setCourier(json.claim?.courier ?? "");
        setTrackingNumber(json.claim?.trackingNumber ?? "");
      }
    } finally {
      setLoadingHistory(false);
    }
  }, [user, claim]);

  useEffect(() => {
    if (open && claim) {
      setStatus(claim.status);
      setCourier(claim.courier ?? "");
      setTrackingNumber(claim.trackingNumber ?? "");
      void fetchDetail();
    }
  }, [open, claim, fetchDetail]);

  const saveStatus = async () => {
    if (!user || !claim) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/console/rewards", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          claimId: claim.id,
          status,
          courier: status === "shipped" ? courier : undefined,
          trackingNumber: status === "shipped" ? trackingNumber : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to update claim");
        return;
      }
      toast.success("Claim updated");
      onUpdated();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  if (!claim) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-white/10 bg-zinc-950 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-white">Claim Details</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
              Reference
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-amber-400">
              {claim.referenceNumber}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                  statusBadgeClass(claim.status)
                )}
              >
                {REWARD_STATUS_LABELS[claim.status]}
              </span>
            </div>
          </div>

          <DetailBlock label="Reward" value={claim.rewardName} />
          <DetailBlock label="Name" value={claim.memberName} />
          <DetailBlock label="Email" value={claim.memberEmail} />
          <DetailBlock label="Phone" value={claim.memberPhone} />
          <DetailBlock
            label="Delivery address"
            value={formatDeliveryAddress(claim.deliveryAddress)}
            multiline
          />
          <DetailBlock
            label="Claim date"
            value={formatClaimDate(claim.claimedAt)}
          />

          <div className="rounded-xl border border-white/5 p-3 space-y-3">
            <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
              Update status
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(REWARD_STATUS_LABELS) as RewardClaimStatus[]).map(
                (key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatus(key)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs cursor-pointer",
                      status === key
                        ? "bg-amber-500/20 text-amber-400"
                        : "border border-white/10 text-zinc-500 hover:text-white"
                    )}
                  >
                    {REWARD_STATUS_LABELS[key]}
                  </button>
                )
              )}
            </div>

            {status === "shipped" && (
              <div className="space-y-3 border-t border-white/5 pt-3">
                <div className="space-y-2">
                  <Label>Courier</Label>
                  <Input
                    value={courier}
                    onChange={(e) => setCourier(e.target.value)}
                    placeholder="J&T, Ninja Van, LBC…"
                    className="border-white/10 bg-black/40"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_COURIERS.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setCourier(name)}
                        className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400 cursor-pointer hover:text-white"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tracking number</Label>
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="border-white/10 bg-black/40"
                  />
                </div>
              </div>
            )}

            <GoldButton
              className="w-full"
              disabled={saving}
              onClick={() => void saveStatus()}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </GoldButton>
          </div>

          <div className="rounded-xl border border-white/5 p-3">
            <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
              Status history
            </p>
            {loadingHistory ? (
              <p className="mt-2 text-xs text-zinc-500">Loading…</p>
            ) : history.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No history yet</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "font-medium capitalize",
                          statusBadgeClass(entry.status)
                        )}
                      >
                        {REWARD_STATUS_LABELS[entry.status]}
                      </span>
                      <span className="text-zinc-500">
                        {formatClaimDate(entry.updatedAt)}
                      </span>
                    </div>
                    {entry.courier ? (
                      <p className="mt-1 text-zinc-400">
                        Courier: {entry.courier}
                      </p>
                    ) : null}
                    {entry.trackingNumber ? (
                      <p className="text-zinc-400">
                        Tracking: {entry.trackingNumber}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailBlock({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-sm text-white",
          multiline && "whitespace-pre-line"
        )}
      >
        {value}
      </p>
    </div>
  );
}
