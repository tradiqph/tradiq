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
import { maskAccountNumber } from "@/lib/withdrawal-accounts";
import { WithdrawalAccount } from "@/types";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WithdrawModal({ open, onOpenChange }: WithdrawModalProps) {
  const { user, profile } = useAuth();
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
  const hasPin = Boolean(profile?.securityPinHash);
  const selected = accounts.find((a) => a.id === selectedAccount);

  const handleSubmit = async () => {
    if (!user || num <= 0 || num > walletBalance) return;
    if (!selectedAccount) {
      toast.error("Add a withdrawal account first");
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
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
      if (!res.ok) throw new Error(data.error ?? "Withdrawal failed");
      toast.success("Withdrawal request submitted");
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
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border-amber-500/20 bg-black text-white"
          />
        </div>

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

        <GoldButton
          onClick={handleSubmit}
          disabled={loading || num <= 0 || num > walletBalance || !selectedAccount}
          className="w-full"
        >
          {loading ? "Submitting..." : "Submit Withdrawal Request"}
        </GoldButton>
      </DialogContent>
    </Dialog>
  );
}
