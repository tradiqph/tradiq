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
import {
  BOT_PRESETS,
  BOT_TERM_DAYS,
  calculateBotTermProjection,
  DAILY_BOT_RATE,
  formatPeso,
} from "@/lib/finance";
import { subscribeBotOnClient } from "@/lib/bots";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Calendar, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const projection =
    num > 0 ? calculateBotTermProjection(num) : null;
  const dailyRateLabel = `${Math.round(DAILY_BOT_RATE * 100)}%`;

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
        const botId = await subscribeBotOnClient(user.uid, num);
        try {
          await fetch("/api/referral/apply-commissions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ amount: num }),
          });
        } catch {
          // Commission sync is best-effort for local dev fallback
        }
        try {
          await fetch("/api/notifications/bot-investment", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ amount: num, botId }),
          });
        } catch {
          // Admin email is best-effort for local dev fallback
        }
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
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors cursor-pointer",
                num === preset
                  ? "border-amber-400 bg-amber-500/25 text-amber-300 shadow-[0_0_12px_rgba(212,175,55,0.25)]"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/15"
              )}
            >
              ₱{preset.toLocaleString()}
            </button>
          ))}
        </div>

        {projection ? (
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-zinc-950 to-amber-500/10 p-4">
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-400/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl" />

            <div className="relative space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">
                    {projection.termDays}-Day Projection
                  </p>
                </div>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                  +{projection.returnPercent}% returns
                </span>
              </div>

              <div className="text-center">
                <p className="text-[11px] text-zinc-400">
                  Total you receive after {projection.termDays} days
                </p>
                <PesoAmount
                  amount={projection.totalReturn}
                  className="mt-1 block bg-gradient-to-r from-emerald-300 via-amber-200 to-yellow-300 bg-clip-text text-3xl text-transparent"
                />
                <p className="mt-1.5 text-[10px] text-zinc-500">
                  Principal returned + daily earnings credited to your wallet
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/5 bg-black/40 px-2 py-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wide text-zinc-500">
                    Principal
                  </p>
                  <PesoAmount
                    amount={projection.principal}
                    className="mt-0.5 text-sm text-white"
                  />
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-2 py-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wide text-emerald-400/80">
                    Interest
                  </p>
                  <PesoAmount
                    amount={projection.totalInterest}
                    gold
                    className="mt-0.5 text-sm"
                  />
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-2 py-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wide text-amber-400/80">
                    Daily
                  </p>
                  <PesoAmount
                    amount={projection.dailyEarning}
                    gold
                    className="mt-0.5 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-500/5 px-3 py-2.5">
                <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <p className="text-[10px] leading-relaxed text-zinc-400">
                  Earn{" "}
                  <span className="font-semibold text-amber-300">
                    {dailyRateLabel} per day
                  </span>{" "}
                  for {projection.termDays} days — that&apos;s{" "}
                  <span className="font-semibold text-emerald-300">
                    {formatPeso(projection.totalInterest)}
                  </span>{" "}
                  in interest, then your{" "}
                  <span className="font-semibold text-white">
                    {formatPeso(projection.principal)}
                  </span>{" "}
                  principal is returned to your wallet.
                </p>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-500">
                <Calendar className="h-3 w-3 text-amber-500/70" />
                <span>
                  {projection.termDays}-day term · {dailyRateLabel} daily ·
                  capital returned on completion
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-amber-500/20 bg-amber-500/5 px-4 py-5 text-center">
            <TrendingUp className="mx-auto mb-2 h-5 w-5 text-amber-400/60" />
            <p className="text-sm font-medium text-zinc-300">
              See your 30-day earnings
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
              Pick a preset or enter an amount to preview total interest plus
              principal returned after {BOT_TERM_DAYS} days at {dailyRateLabel}{" "}
              daily.
            </p>
          </div>
        )}

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
