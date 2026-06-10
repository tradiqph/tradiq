"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ChevronDown, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoldButton } from "@/components/ui/gold-button";
import { PesoAmount } from "@/components/ui/peso-amount";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  calculateWithdrawalBreakdown,
  formatPeso,
  validateWithdrawalAmount,
  WITHDRAWAL_MAX_AMOUNT,
  WITHDRAWAL_MIN_AMOUNT,
} from "@/lib/finance";
import { createWithdrawalOnClient } from "@/lib/withdrawals";
import { maskAccountNumber } from "@/lib/withdrawal-accounts";
import { WithdrawalAccount } from "@/types";
import { cn } from "@/lib/utils";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WithdrawModal({ open, onOpenChange }: WithdrawModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [accounts, setAccounts] = useState<(WithdrawalAccount & { id: string })[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !db || !open) return;
    getDocs(collection(db, "users", user.uid, "withdrawalAccounts")).then(
      (snap) => {
        const accs = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as WithdrawalAccount),
        }));
        setAccounts(accs);
        if (accs.length) setSelectedAccount(accs[0].id);
      }
    );
  }, [user, open]);

  const walletBalance = profile?.walletBalance ?? 0;
  const num = parseFloat(amount) || 0;
  const breakdown = num > 0 ? calculateWithdrawalBreakdown(num) : null;
  const hasPin = Boolean(profile?.securityPinHash);
  const selected = accounts.find((a) => a.id === selectedAccount);

  const amountError = num > 0 ? validateWithdrawalAmount(num) : null;
  const exceedsBalance = num > walletBalance;

  const handleSubmit = async () => {
    if (!user || amountError || exceedsBalance) return;
    if (!selectedAccount || !selected) {
      toast.error("Add a withdrawal account first");
      return;
    }
    if (hasPin && !pin) {
      toast.error("Enter your security PIN");
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/withdrawals/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: num,
          accountId: selectedAccount,
          pin: hasPin ? pin : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.withdrawLocally) {
        throw new Error(data.error ?? "Withdrawal failed");
      }

      if (data.withdrawLocally) {
        await createWithdrawalOnClient({
          userId: user.uid,
          userEmail: profile?.email ?? user.email ?? "",
          amount: num,
          accountSnapshot: selected,
          securityPinHash: profile?.securityPinHash ?? null,
          pin: hasPin ? pin : undefined,
        });
      }
      toast.success(
        breakdown
          ? `${formatPeso(breakdown.amount)} deducted · pending approval`
          : "Withdrawal request submitted"
      );
      await refreshProfile();
      onOpenChange(false);
      setAmount("");
      setPin("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-amber-500/20 bg-zinc-950 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5 text-amber-400" />
            Request Withdrawal
          </DialogTitle>
        </DialogHeader>

        <div className="surface-flat p-3">
          <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            Available Balance
          </p>
          <PesoAmount amount={walletBalance} gold className="text-2xl" />
        </div>

        {accounts.length > 0 ? (
          <div className="space-y-2">
            <Label className="text-zinc-400">Payout Account</Label>
            <div className="relative">
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full appearance-none rounded-lg border border-amber-500/20 bg-black px-3 py-2.5 pr-10 text-sm text-white outline-none focus:border-amber-500/50 cursor-pointer"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} className="bg-zinc-950">
                    {a.label} — {maskAccountNumber(a.accountType, a.accountNumber)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </div>
            {selected && (
              <div className="flex flex-col gap-1 rounded-lg border border-white/5 bg-black/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge className="border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-400">
                    {selected.accountType}
                  </Badge>
                  {selected.bankName && (
                    <span className="truncate text-xs text-zinc-400">
                      {selected.bankName}
                    </span>
                  )}
                </div>
                <span className="truncate text-xs text-zinc-500">
                  {selected.accountName}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="surface-flat flex flex-col items-center gap-2 p-4 text-center">
            <Wallet className="h-8 w-8 text-amber-400/60" />
            <p className="text-sm text-zinc-400">No saved payout accounts yet.</p>
            <Link
              href="/account"
              onClick={() => onOpenChange(false)}
              className="text-sm text-amber-400 hover:underline"
            >
              Add one in Account settings →
            </Link>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-zinc-400">Amount (₱)</Label>
          <Input
            type="number"
            placeholder="0.00"
            min={WITHDRAWAL_MIN_AMOUNT}
            max={WITHDRAWAL_MAX_AMOUNT}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border-amber-500/20 bg-black text-white"
          />
          <p className="text-[11px] text-zinc-500">
            Min {formatPeso(WITHDRAWAL_MIN_AMOUNT)} · Max{" "}
            {formatPeso(WITHDRAWAL_MAX_AMOUNT)} per request
          </p>
          {amountError && (
            <p className="text-xs text-red-400">{amountError}</p>
          )}
          {exceedsBalance && num > 0 && !amountError && (
            <p className="text-xs text-red-400">Insufficient wallet balance</p>
          )}
        </div>

        {breakdown ? (
          <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-zinc-950 to-zinc-950 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Withdrawal Summary
              </p>
              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                4% processing fee
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-400">Requested amount</span>
                <PesoAmount amount={breakdown.amount} className="text-white" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-400">Processing fee (4%)</span>
                <span className="font-semibold tabular-nums text-red-400">
                  −{formatPeso(breakdown.processingFee)}
                </span>
              </div>
              <div className="border-t border-white/5 pt-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-zinc-300">You receive</span>
                  <PesoAmount
                    amount={breakdown.netPayout}
                    gold
                    className="text-lg"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-black/40 px-3 py-2.5">
              <p className="text-[10px] leading-relaxed text-zinc-500">
                <span className="font-semibold text-zinc-300">
                  {formatPeso(breakdown.amount)}
                </span>{" "}
                will be deducted from your balance immediately and marked as{" "}
                <span className="font-semibold text-amber-300">pending</span>{" "}
                until admin approval. Your payout account receives{" "}
                <span className="font-semibold text-emerald-300">
                  {formatPeso(breakdown.netPayout)}
                </span>
                .
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-amber-500/15 bg-amber-500/5 px-3 py-2.5 text-center text-[11px] text-zinc-500">
            Enter an amount to see the 4% processing fee and net payout.
          </p>
        )}

        {hasPin && (
          <div className="space-y-1.5">
            <Label className="text-zinc-400">Security PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter your PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="border-amber-500/20 bg-black text-white"
            />
          </div>
        )}

        <p className="text-center text-xs text-zinc-500">
          Withdrawal waiting time may take up to 24–48 hours for processing.
        </p>

        <GoldButton
          onClick={handleSubmit}
          disabled={
            loading ||
            num <= 0 ||
            Boolean(amountError) ||
            exceedsBalance ||
            !selectedAccount ||
            (hasPin && pin.length < 4)
          }
          className={cn("w-full", breakdown && "mt-1")}
        >
          {loading
            ? "Submitting..."
            : breakdown
              ? `Request ${formatPeso(breakdown.amount)} Withdrawal`
              : "Submit Withdrawal Request"}
        </GoldButton>
      </DialogContent>
    </Dialog>
  );
}
