"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoldButton } from "@/components/ui/gold-button";
import { GlassCard } from "@/components/ui/glass-card";
import { PesoAmount } from "@/components/ui/peso-amount";
import { BOT_PRESETS } from "@/lib/finance";
import { subscribeBotOnClient } from "@/lib/bots";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

interface SubscribeBotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SubscribeBotModal({
  open,
  onOpenChange,
  onSuccess,
}: SubscribeBotModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const available = profile?.walletBalance ?? 0;
  const num = parseFloat(amount) || 0;
  const isEmpty = available <= 0;

  const handleConfirm = async () => {
    if (!user || num <= 0 || num > available) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/bots/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: num }),
      });
      const data = await res.json();
      if (!res.ok && !data.subscribeLocally) {
        throw new Error(data.error ?? "Subscription failed");
      }

      if (data.subscribeLocally) {
        await subscribeBotOnClient(user.uid, num);
      }

      toast.success("Copy trading bot activated!");
      await refreshProfile();
      onSuccess?.();
      onOpenChange(false);
      setAmount("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-amber-500/20 bg-zinc-950 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle>New Copy Trading Bot</DialogTitle>
        </DialogHeader>

        <GlassCard className="space-y-3 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-amber-400" />
              <div>
                <p className="text-xs text-amber-400/80">Available to Subscribe</p>
                <PesoAmount amount={available} className="text-xl text-white" />
              </div>
            </div>
            {isEmpty && (
              <span className="text-xs text-red-400">Empty</span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500">
            Subscribe using your wallet balance. Withdrawals are available for
            earnings and returned capital.
          </p>
        </GlassCard>

        <div>
          <Label className="text-zinc-400">AMOUNT (₱)</Label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 border-amber-500/20 bg-black text-lg text-white"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {BOT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-400 cursor-pointer"
            >
              ₱{preset.toLocaleString()}
            </button>
          ))}
        </div>

        <GoldButton
          onClick={handleConfirm}
          disabled={loading || num <= 0 || num > available}
          className="w-full"
        >
          Confirm Copy Trading Bot
        </GoldButton>
      </DialogContent>
    </Dialog>
  );
}
