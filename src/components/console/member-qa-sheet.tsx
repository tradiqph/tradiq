"use client";

import { useCallback, useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { ConsoleError } from "@/components/console/console-error";
import { ConsoleLoader } from "@/components/console/console-loader";
import { GoldButton } from "@/components/ui/gold-button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { QA_TEST_ACCOUNT_EMAIL } from "@/lib/console/qa-eligibility-shared";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MemberQaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    displayName: string;
    email: string;
  } | null;
}

interface QaStatus {
  isTestAccount: boolean;
  overrideEnabled: boolean;
  expiresAt: string | null;
  memberRank: string;
  claimedRewardTiers: string[];
  claimsCount: number;
  pendingClaimsCount: number;
  error?: string;
}

function formatExpiry(value: string | null): string {
  if (!value) return "No expiry set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No expiry set";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function StatusRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white/[0.02] p-3",
        highlight
          ? "border-amber-500/40 ring-1 ring-amber-500/20"
          : "border-white/5"
      )}
    >
      <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

export function MemberQaSheet({
  open,
  onOpenChange,
  member,
}: MemberQaSheetProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<QaStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!user || !member) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/console/members/${member.id}/qa-eligibility`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const json = (await res.json()) as QaStatus;
      if (!res.ok) {
        setError(json.error ?? "Failed to load QA status");
        return;
      }
      setStatus(json);
    } finally {
      setLoading(false);
    }
  }, [user, member]);

  useEffect(() => {
    if (open && member) {
      void fetchStatus();
    } else if (!open) {
      setStatus(null);
      setError(null);
    }
  }, [open, member, fetchStatus]);

  const runAction = async (
    action: "markTestAccount" | "enable" | "disable" | "reset"
  ) => {
    if (!user || !member) return;
    setActing(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/console/members/${member.id}/qa-eligibility`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        }
      );
      const json = (await res.json()) as QaStatus;
      if (!res.ok) {
        throw new Error(json.error ?? "Action failed");
      }
      setStatus(json);
      toast.success("QA settings updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col border-white/10 bg-zinc-950 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <FlaskConical className="h-5 w-5 text-amber-400" />
            QA Test Tools
          </SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-2">
          {member ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <p className="text-sm font-medium text-white">
                {member.displayName || member.email}
              </p>
              <p className="text-xs text-zinc-500">{member.email}</p>
              <p className="mt-2 text-[10px] text-zinc-500">
                Designated test account: {QA_TEST_ACCOUNT_EMAIL}
              </p>
            </div>
          ) : null}

          {loading ? (
            <ConsoleLoader label="Loading QA status…" />
          ) : error ? (
            <ConsoleError message={error} />
          ) : status ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <StatusRow
                  label="Test account"
                  value={status.isTestAccount ? "Yes" : "No"}
                  highlight={status.isTestAccount}
                />
                <StatusRow
                  label="Override"
                  value={status.overrideEnabled ? "Active" : "Off"}
                  highlight={status.overrideEnabled}
                />
                <StatusRow label="Current rank" value={status.memberRank} />
                <StatusRow
                  label="Claims"
                  value={`${status.claimsCount} total · ${status.pendingClaimsCount} pending`}
                />
              </div>

              {status.overrideEnabled && status.expiresAt ? (
                <p className="text-xs text-zinc-500">
                  Override expires: {formatExpiry(status.expiresAt)}
                </p>
              ) : null}

              {status.claimedRewardTiers.length > 0 ? (
                <p className="text-xs text-zinc-500">
                  Claimed tiers: {status.claimedRewardTiers.join(", ")}
                </p>
              ) : null}

              <div className="space-y-2">
                {!status.isTestAccount ? (
                  <GoldButton
                    className="w-full"
                    disabled={acting}
                    onClick={() => void runAction("markTestAccount")}
                  >
                    Mark as test account
                  </GoldButton>
                ) : null}

                {status.isTestAccount && !status.overrideEnabled ? (
                  <GoldButton
                    className="w-full"
                    disabled={acting}
                    onClick={() => void runAction("enable")}
                  >
                    Enable QA eligibility
                  </GoldButton>
                ) : null}

                {status.isTestAccount && status.overrideEnabled ? (
                  <>
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => void runAction("reset")}
                      className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/15 disabled:opacity-50"
                    >
                      Reset test state
                    </button>
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => void runAction("disable")}
                      className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
                    >
                      Disable QA eligibility
                    </button>
                  </>
                ) : null}
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-zinc-400">
                <p className="font-medium text-zinc-300">How to test</p>
                <ol className="mt-2 list-inside list-decimal space-y-1">
                  <li>Mark as test account, then enable QA eligibility.</li>
                  <li>Log in as {QA_TEST_ACCOUNT_EMAIL}.</li>
                  <li>Activate Leader rank and claim the ₱500K reward.</li>
                  <li>Use Reset to re-test without touching real referral data.</li>
                </ol>
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
